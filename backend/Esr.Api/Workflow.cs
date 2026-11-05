using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace Esr.Api;

/// <summary>Authoritative workflow rules. Call under the store lock for atomic transitions.</summary>
public sealed class Workflow(StoreData data)
{
    public StoreData Data { get; } = data;
    public object Sync { get; } = new();
    public static void Require(bool valid, string message, int status = 400) { if (!valid) throw new RuleException(message, status); }
    static string Get(JsonObject d, string key) => d[key]?.GetValue<string>() ?? "";
    static string Required(JsonObject d, string key) { var value = Get(d, key); Require(!string.IsNullOrWhiteSpace(value), $"{key} is required."); return value.Trim(); }
    static readonly Regex JcnFormat = new("^[0-9]{5}[A-Z0-9]{4}(?!0000)[0-9]{4}$", RegexOptions.CultureInvariant);
    /// <summary>Normalizes a JCN to upper case and requires 5 digits, 4 letters or digits, then a 0001–9999 sequence (12345WX019999).</summary>
    public static string Jcn(string value)
    {
        var jcn = value.Trim().ToUpperInvariant();
        Require(JcnFormat.IsMatch(jcn), "JCN must be 13 characters: 5 digits, 4 letters or digits, then 0001–9999 (for example 12345WX019999).");
        return jcn;
    }
    static void Role(Actor a, params string[] roles) => Require(roles.Contains(a.Role), "Your active role cannot perform this action.", 403);
    public string Access(Actor a, EsrRecord r) => a.Site == r.Site ? "full" : Data.Permissions.GetValueOrDefault(a.Id)?.CrossSite ?? "none";
    public IEnumerable<EsrRecord> Visible(Actor a) => Data.Records.Where(r => Access(a, r) != "none");
    public EsrRecord Find(Actor a, string id) => Visible(a).FirstOrDefault(r => r.Id == id) ?? throw new RuleException("ESR not found.", 404);
    void Local(Actor a, EsrRecord r) => Require(Access(a, r) == "full", "This record is read-only for your facility.", 403);
    void Editor(Actor a, EsrRecord r)
    {
        Local(a, r); Require(r.Status == "In Process", "Only an In Process draft can be edited.", 409);
        Require(r.EngineerId == a.Id || a.Role == "Supervisor", "Only the assigned engineer or supervisor can edit this draft.", 403);
    }
    static Evidence Sign(Actor a, string block, string comment = "") => new() { UserId = a.Id, Name = a.Name, Block = block, Comment = comment };
    static void Audit(EsrRecord r, Actor a, string action) { r.Audit.Add(new() { Actor = a.Name, Action = action }); r.UpdatedAt = DateTimeOffset.UtcNow.ToString("O"); r.Version++; }
    public static string RevisionSuffix(int index)
    {
        Require(index is >= 1 and <= 702, "Revision limit reached.");
        return index <= 26 ? ((char)(64 + index)).ToString() : $"{(char)(64 + (index - 1) / 26)}{(char)(65 + (index - 1) % 26)}";
    }
    int AllocateSequence(int year)
    {
        if (Data.SequenceYear != year) { Data.SequenceYear = year; Data.Sequence = 0; }
        Require(Data.Sequence < 9999, "Annual serial limit reached.");
        return ++Data.Sequence;
    }
    /// <param name="lds">CRACN context for the request's JCN; null only when the JCN is N/A.</param>
    public EsrRecord Create(Actor actor, JsonObject d, LdsData? lds = null)
    {
        Role(actor, "Requestor", "Shop", "Engineer", "Supervisor");
        var r = new EsrRecord { Title = Required(d, "title"), Name = Required(d, "name"), Shop = Required(d, "shop"), Phone = Required(d, "phone"), References = Required(d, "references"), Condition = Required(d, "condition"), Jcn = Required(d, "jcn"), RequestorId = actor.Id, Site = actor.Site };
        if (r.Jcn != "N/A") r.Jcn = Jcn(r.Jcn);
        Require(r.Jcn == "N/A" || lds is not null, "Import a JCN from CRACN or select N/A.");
        if (r.Jcn != "N/A" && lds is not null) { r.WorkStatement = lds.WorkStatement; r.Refit = lds.Refit; r.Component = lds.Component; r.Location = lds.Location; }
        Audit(r, actor, "Request submitted"); Data.Records.Insert(0, r); return r;
    }
    /// <summary>Validate a deep copy before commit so failed actions cannot partially alter records.</summary>
    public EsrRecord? Execute(Actor a, string id, string action, JsonObject d)
    {
        var original = Find(a, id); var r = JsonConfig.Clone(original);
        if (d["version"] is not null) Require(d["version"]!.GetValue<int>() == r.Version, "This record changed. Reload it before trying again.", 409);
        var permission = Data.Permissions.GetValueOrDefault(a.Id) ?? new(); var comment = Get(d, "comment");
        switch (action)
        {
            case "assign":
                Local(a, r); Role(a, "Supervisor"); Require(r.Status == "Unassigned", "Only unassigned requests can be assigned.", 409);
                var engineer = Data.Users.Find(u => u.Id == Get(d, "engineerId") && u.Site == r.Site && u.Role == "Engineer"); Require(engineer is not null, "Select a local engineer.");
                var year = DateTime.UtcNow.Year; var sequence = AllocateSequence(year);
                r.EngineerId = engineer!.Id; r.SerialBase = EsrNumber.Base(year, sequence); r.Revision = 1; r.Serial = EsrNumber.Format(r.SerialBase, r.Revision); r.Status = "In Process"; r.Rejected = false; break;
            case "reject":
                Local(a, r); Role(a, "Supervisor"); Require(r.Status == "Unassigned", "Only unassigned requests can be returned.", 409); Required(d, "comment"); r.Rejected = true; r.Comments.Add(new() { Name = a.Name, UserId = a.Id, Text = comment }); break;
            case "resubmit":
                Local(a, r); Require(r.RequestorId == a.Id && r.Rejected && r.Status == "Unassigned", "Only the original requestor can resubmit a returned request.", 403); r.Condition = Required(d, "condition"); r.Rejected = false; break;
            case "delete":
                Local(a, r); Role(a, "Supervisor"); Require(r.Status == "Unassigned", "Only unassigned requests can be deleted.", 409); Data.Records.Remove(original); return null;
            case "draft":
                Editor(a, r); r.Resolution = Get(d, "resolution"); r.Rationale = Get(d, "rationale"); r.Dfs = Get(d, "dfs"); r.DfsReference = Get(d, "dfsReference"); r.Tvd = Get(d, "tvd"); r.TvdReference = Get(d, "tvdReference");
                r.Attributes = d["attributes"]?.AsArray().Select(n => n!.GetValue<string>()).ToList() ?? [];
                Require(r.Attributes.All(x => new[] { "Level 1", "Requires Rev", "SOC", "SUBSAFE" }.Contains(x)), "Invalid attribute."); break;
            case "resolve":
                Local(a, r); Require(r.Status == "In Process", "Record must be In Process.", 409); Require(r.EngineerId == a.Id || permission.DualSign, "Only the assigned engineer or a delegated signer can resolve.", 403);
                if (permission.DualSign && r.EngineerId != a.Id) Required(d, "comment");
                Require(!string.IsNullOrWhiteSpace(r.Resolution), "Resolution is required."); Require(!string.IsNullOrWhiteSpace(r.Rationale), "Rationale is required.");
                Require(r.Dfs is "yes" or "no", "DFS Required must be answered."); Require(r.Tvd is "yes" or "no", "TVD Required must be answered.");
                Require(r.Dfs != "yes" || !string.IsNullOrWhiteSpace(r.DfsReference), "DFS reference is required."); Require(r.Tvd != "yes" || !string.IsNullOrWhiteSpace(r.TvdReference), "TVD reference is required.");
                r.Signatures.Add(Sign(a, "Resolved By", comment)); r.Status = "Awaiting Approval"; break;
            case "approve":
                Local(a, r); Require(r.Status == "Awaiting Approval", "Record must be Awaiting Approval.", 409); Require(a.Role == "Supervisor" || permission.DualSign, "Supervisor approval is required.", 403);
                if (permission.DualSign || r.Signatures.Any(s => s.Block == "Resolved By" && s.UserId == a.Id)) { Require(permission.DualSign, "Signing both blocks requires administrator delegation.", 403); Required(d, "comment"); }
                r.Signatures.Add(Sign(a, "Approved By", comment)); r.Status = "ESR Issued"; break;
            case "return":
                Local(a, r); Role(a, "Supervisor"); Require(r.Status == "Awaiting Approval", "Record must be Awaiting Approval.", 409); Required(d, "comment"); r.Comments.Add(new() { UserId = a.Id, Name = a.Name, Text = comment }); r.Signatures.Clear(); r.Status = "In Process"; break;
            case "complete":
                Local(a, r); Role(a, "Shop"); Require(r.Status == "ESR Issued" && r.Completion is null, "Work must be issued and awaiting shop sign-off.", 409);
                var status = Get(d, "status"); Require(new[] { "Completed", "Deferred", "Other", "Canceled" }.Contains(status), "Choose a completion status.");
                if (status != "Completed") Required(d, "explanation"); r.Completion = new() { Status = status, Explanation = Get(d, "explanation"), Shop = Required(d, "shop"), Name = a.Name, Date = DateTime.UtcNow.ToString("yyyy-MM-dd") };
                r.Signatures.Add(Sign(a, "Shop Representative", r.Completion.Explanation)); if (status == "Deferred") r.Status = "ESR Issued – Deferred"; break;
            case "close":
                Local(a, r); Role(a, "Division Head"); Require(r.Completion is not null && r.Status.StartsWith("ESR Issued"), "Shop sign-off is required before closeout.", 409);
                if (r.Completion!.Status == "Deferred") Require(d["acknowledgeDeferred"]?.GetValue<bool>() == true, "Acknowledge the deferred disposition before closeout.");
                r.Signatures.Add(Sign(a, "Division Head", comment)); r.Status = "ESR Closed"; break;
            case "revise":
                Local(a, r); Role(a, "Engineer", "Supervisor"); Require(r.Status.StartsWith("ESR Issued") || r.Status == "ESR Closed", "Only issued or closed records can be revised.", 409); var reason = Required(d, "reason");
                Require(!string.IsNullOrEmpty(r.SerialBase), "Assigned records carry an ESR number.", 409);
                var next = r.Revision + 1; var suffix = RevisionSuffix(next); var snapshot = JsonConfig.Clone(r); snapshot.Revisions.Clear(); r.Revisions.Add(snapshot); r.Revision = next; r.Serial = r.SerialBase + suffix; r.RevisionReason = reason;
                if (a.Role == "Engineer") r.EngineerId = a.Id; r.Status = "In Process"; r.Signatures.Clear(); r.Completion = null; break;
            case "comment":
                Require(Access(a, r) != "read", "Read-only users cannot comment.", 403); r.Comments.Add(new() { UserId = a.Id, Name = a.Name, Text = Required(d, "text") }); break;
            case "attach":
                Local(a, r); if (r.Status == "Unassigned") Require(a.Id == r.RequestorId || a.Role == "Supervisor", "Only the requestor or supervisor can attach files.", 403); else Editor(a, r);
                var type = Get(d, "type"); Require(new[] { "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain" }.Contains(type), "Supported files: PNG, JPEG, WebP, PDF, TXT.");
                var section = Get(d, "section"); Require(new[] { "Condition", "Reference", "Continuation" }.Contains(section), "Select an attachment section.");
                byte[] bytes; try { bytes = Convert.FromBase64String(Required(d, "base64")); } catch (FormatException) { throw new RuleException("Invalid attachment data."); }
                Require(bytes.Length is > 0 and <= 15 * 1024 * 1024, "File must be between 1 byte and 15 MB."); Require(r.Attachments.Count < 20, "Maximum 20 files per record.");
                r.Attachments.Add(new() { Name = Required(d, "name"), Type = type, Section = section, Base64 = Convert.ToBase64String(bytes), Size = bytes.Length, UploadedBy = a.Name }); break;
            default: throw new RuleException("Unknown action.", 404);
        }
        Audit(r, a, action == "revise" ? $"Revision {RevisionSuffix(r.Revision)}: {r.RevisionReason}" : action);
        Data.Records[Data.Records.IndexOf(original)] = r; return r;
    }
    public void SetPermission(Actor actor, JsonObject d)
    {
        Role(actor, "Administrator"); var id = Required(d, "userId"); Require(Data.Users.Any(u => u.Id == id), "Unknown user."); var access = Get(d, "crossSite"); Require(access is "none" or "read" or "review", "Invalid cross-facility access.");
        Data.Permissions[id] = new() { CrossSite = access, DualSign = d["dualSign"]?.GetValue<bool>() == true, UpdatedBy = actor.Name, UpdatedAt = DateTimeOffset.UtcNow.ToString("O") };
    }
    public object Search(Actor actor, JsonObject d)
    {
        var condition = Required(d, "condition"); var terms = Tokens(condition);
        return new { summary = $"Inspection finding: {condition[..Math.Min(condition.Length, 210)]}", matches = Visible(actor).Where(r => r.Status == "ESR Closed").Select(r => new { r.Id, r.Serial, r.Title, r.Resolution, r.Rationale, similarity = (int)Math.Round(100.0 * terms.Intersect(Tokens(r.Condition)).Count() / Math.Max(terms.Count, 1)) }).OrderByDescending(r => r.similarity).Take(3) };
    }
    static HashSet<string> Tokens(string text) => System.Text.RegularExpressions.Regex.Matches(text.ToLowerInvariant(), "[a-z]{4,}").Select(m => m.Value).ToHashSet();
    public static EsrRecord Public(EsrRecord record) { var copy = JsonConfig.Clone(record); foreach (var a in copy.Attachments) a.Base64 = ""; copy.Revisions = copy.Revisions.Select(Public).ToList(); return copy; }
}
