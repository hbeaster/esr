using System.Text;
using System.Text.RegularExpressions;
namespace Esr.Api;

/// <summary>Dependency-free paginated PDF with an attachment manifest and embedded original files.</summary>
public static class PdfExport
{
    static string Clean(string value) => new(value.Select(c => c is >= ' ' and <= '~' ? c : '-').ToArray());
    static string Escape(string value) => Clean(value).Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
    public static byte[] Generate(EsrRecord r)
    {
        var lines = new List<string>();
        void Add(string title, string value)
        {
            lines.Add(""); lines.Add(title.ToUpperInvariant());
            foreach (var paragraph in (string.IsNullOrWhiteSpace(value) ? "Not provided" : value).Split('\n'))
            {
                var words = Regex.Matches(paragraph, @"\S{1,84}").Select(m => m.Value); var line = "";
                foreach (var word in words) { if (line.Length + word.Length + 1 > 86) { lines.Add(line); line = ""; } line += (line.Length == 0 ? "" : " ") + word; }
                lines.Add(line);
            }
        }
        Add("Request", r.Title); Add("Requestor", $"{r.Name} | Shop {r.Shop} | {r.Phone}"); Add("Equipment", $"JCN {r.Jcn} | Refit {r.Refit}\n{r.Component} | {r.Location}\n{r.WorkStatement}");
        Add("References", r.References); Add("DFS / TVD", $"DFS: {r.Dfs} {r.DfsReference}\nTVD: {r.Tvd} {r.TvdReference}"); Add("Condition / finding", r.Condition);
        if (r.Revision > 0) Add("Revision reason", r.RevisionReason);
        Add("Resolution / continuation sheet", r.Resolution); Add("Engineering rationale", r.Rationale);
        Add("Block 25 / 26 - Shop completion", r.Completion is null ? "Awaiting shop sign-off" : $"{r.Completion.Status} | {r.Completion.Name} | {r.Completion.Shop} | {r.Completion.Date}\n{r.Completion.Explanation}");
        Add("Simulated digital signatures", string.Join('\n', r.Signatures.Select(s => $"{s.Block}: {s.Name} [{s.UserId}] | {s.Time}\n{s.Comment}")));
        Add("Original files embedded in this PDF", string.Join('\n', r.Attachments.Select(a => $"{a.Section}: {a.Name} ({a.Size} bytes) | {a.UploadedBy}")));
        Add("Comments", string.Join('\n', r.Comments.Select(c => $"{c.Name} | {c.Time}\n{c.Text}")));
        Add("Audit trail", string.Join('\n', r.Audit.Select(a => $"{a.Time} | {a.Actor} | {a.Action}")));
        var objects = new List<byte[]> { Array.Empty<byte>(), Array.Empty<byte>(), Encoding.ASCII.GetBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>") };
        int Obj(byte[] bytes) { objects.Add(bytes); return objects.Count; }
        int TextObj(string text) => Obj(Encoding.ASCII.GetBytes(text));
        int Stream(byte[] bytes, string extra = "") { using var ms = new MemoryStream(); ms.Write(Encoding.ASCII.GetBytes($"<< /Length {bytes.Length} {extra} >>\nstream\n")); ms.Write(bytes); ms.Write(Encoding.ASCII.GetBytes("\nendstream")); return Obj(ms.ToArray()); }
        var pages = new List<int>(); var chunks = lines.Chunk(43).ToArray();
        var images = r.Attachments.Select(a => (Attachment: a, Image: PdfImage.Read(a))).Where(x => x.Image is not null).ToArray();
        var totalPages = chunks.Length + images.Length;
        for (var i = 0; i < chunks.Length; i++)
        {
            var labels = string.Join(" | ", new[] { r.Dfs == "yes" ? $"DFS {r.DfsReference}" : "", r.Tvd == "yes" ? $"TVD {r.TvdReference}" : "" }.Concat(r.Attributes).Where(x => x.Length > 0));
            var sb = new StringBuilder("BT /F1 10 Tf 44 750 Td 15 TL\n");
            foreach (var line in new[] { "TRIDENT REFIT FACILITY / ENGINEERING SERVICE REQUEST", $"ESR {r.Serial} | {r.Status}", labels[..Math.Min(labels.Length, 86)], "" }.Concat(chunks[i])) sb.Append($"({Escape(line)}) Tj T*\n");
            sb.Append($"ET BT /F1 8 Tf 44 28 Td (SYNTHETIC DEMO - Not an authorized engineering instruction | Page {i + 1}/{totalPages}) Tj ET");
            var content = Stream(Encoding.ASCII.GetBytes(sb.ToString())); pages.Add(TextObj($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {content} 0 R >>"));
        }
        foreach (var item in images)
        {
            var attachment = item.Attachment; var image = item.Image!;
            var imageObject = Stream(image.Bytes, $"/Type /XObject /Subtype /Image /Width {image.Width} /Height {image.Height} /ColorSpace {image.ColorSpace} /BitsPerComponent 8 /Filter {image.Filter}");
            var scale = Math.Min(524.0 / image.Width, 620.0 / image.Height);
            var width = image.Width * scale; var height = image.Height * scale;
            var layout = FormattableString.Invariant($"q {width:0.###} 0 0 {height:0.###} 44 {700 - height:0.###} cm /Image1 Do Q");
            var heading = $"BT /F1 10 Tf 44 750 Td (ESR {Escape(r.Serial ?? "")} - CONTINUATION IMAGE) Tj 0 -20 Td ({Escape(attachment.Name)}) Tj ET";
            var content = Stream(Encoding.ASCII.GetBytes(heading + "\n" + layout + "\nBT /F1 8 Tf 44 28 Td (SYNTHETIC DEMO - Original file also embedded) Tj ET"));
            pages.Add(TextObj($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> /XObject << /Image1 {imageObject} 0 R >> >> /Contents {content} 0 R >>"));
        }
        var names = new List<string>();
        foreach (var a in r.Attachments) { var stream = Stream(Convert.FromBase64String(a.Base64), "/Type /EmbeddedFile"); var spec = TextObj($"<< /Type /Filespec /F ({Escape(a.Name)}) /EF << /F {stream} 0 R >> >>"); names.Add($"({Escape(a.Id)}) {spec} 0 R"); }
        objects[0] = Encoding.ASCII.GetBytes($"<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [{string.Join(' ', names)}] >> >> >>");
        objects[1] = Encoding.ASCII.GetBytes($"<< /Type /Pages /Count {pages.Count} /Kids [{string.Join(' ', pages.Select(p => $"{p} 0 R"))}] >>");
        using var output = new MemoryStream(); void Write(string text) => output.Write(Encoding.ASCII.GetBytes(text));
        Write("%PDF-1.7\n"); var offsets = new List<long> { 0 };
        for (var i = 0; i < objects.Count; i++) { offsets.Add(output.Position); Write($"{i + 1} 0 obj\n"); output.Write(objects[i]); Write("\nendobj\n"); }
        var xref = output.Position; Write($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets.Skip(1)) Write($"{offset:D10} 00000 n \n");
        Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"); return output.ToArray();
    }
}
