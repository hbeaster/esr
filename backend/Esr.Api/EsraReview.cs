using System.Text.Json;
using System.Text.Json.Nodes;
namespace Esr.Api;

public sealed class EsraMatch
{
    public string Id { get; set; } = "";
    public string? Serial { get; set; }
    public string Title { get; set; } = "";
    public string Status { get; set; } = "";
    public int Similarity { get; set; }
    public string Reason { get; set; } = "";
}
public sealed class EsraReviewResult
{
    public string Summary { get; set; } = "";
    public List<EsraMatch> Matches { get; set; } = [];
}

/// <summary>Builds the review prompt from visible records and keeps the model inside that set.</summary>
public static class EsraReview
{
    public const string SystemPrompt = """
        You help a reviewer decide whether an engineering service request duplicates another request or can reuse a similar resolution.
        Reply with JSON only, no markdown. Use this shape: {"summary":"string","matches":[{"id":"string","similarity":0,"reason":"string"}]}.
        similarity is an integer from 0 to 100. Use only candidate ids. Order matches from highest similarity to lowest and return at most 5.
        The summary describes the request under review. It is a review aid, not an engineering approval.
        """;
    public static string Prompt(EsrRecord current, IReadOnlyList<EsrRecord> others)
    {
        var lines = new List<string> { "Request under review", Describe(current), "", "Other visible ESRs" };
        if (others.Count == 0) lines.Add("None.");
        else lines.AddRange(others.Select(Describe));
        return string.Join('\n', lines);
    }
    static string Describe(EsrRecord record) =>
        $"id: {record.Id} | serial: {record.Serial ?? "unassigned"} | status: {record.Status} | title: {Clip(record.Title, 180)} | condition: {Clip(record.Condition)} | resolution: {Clip(record.Resolution)} | rationale: {Clip(record.Rationale)}";
    static string Clip(string? value, int max = 500)
    {
        var text = (value ?? "").Replace('\n', ' ').Trim();
        return text.Length <= max ? text : text[..max];
    }
    public static EsraReviewResult Parse(string content, EsrRecord current, IReadOnlyList<EsrRecord> others)
    {
        var json = ExtractJson(content);
        JsonObject node;
        try { node = JsonNode.Parse(json)!.AsObject(); }
        catch (JsonException) { throw new RuleException("The AI provider did not return a JSON review.", 502); }
        var summary = Text(node["summary"], 2000);
        if (string.IsNullOrWhiteSpace(summary)) throw new RuleException("The AI provider returned an empty summary.", 502);
        var known = others.Where(r => r.Id != current.Id).ToDictionary(r => r.Id);
        var matches = new List<EsraMatch>();
        foreach (var item in node["matches"]?.AsArray() ?? [])
        {
            if (item is not JsonObject match) continue;
            var id = match["id"]?.GetValue<string>();
            if (id is null || !known.TryGetValue(id, out var record) || matches.Any(m => m.Id == id)) continue;
            matches.Add(new EsraMatch { Id = record.Id, Serial = record.Serial, Title = record.Title, Status = record.Status, Similarity = Percent(match["similarity"]), Reason = Text(match["reason"], 300) });
        }
        return new EsraReviewResult { Summary = summary, Matches = matches.OrderByDescending(m => m.Similarity).Take(5).ToList() };
    }
    static string Text(JsonNode? node, int max)
    {
        if (node is not JsonValue value) return "";
        return value.TryGetValue<string>(out var text) ? Clip(text, max) : "";
    }
    static int Percent(JsonNode? node)
    {
        if (node is not JsonValue value) return 0;
        if (value.TryGetValue<int>(out var whole)) return Math.Clamp(whole, 0, 100);
        if (value.TryGetValue<double>(out var fractional)) return (int)Math.Clamp(Math.Round(fractional), 0, 100);
        return 0;
    }
    public static string ExtractJson(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            var start = trimmed.IndexOf('\n');
            var end = trimmed.LastIndexOf("```", StringComparison.Ordinal);
            if (start >= 0 && end > start) trimmed = trimmed[(start + 1)..end];
        }
        var open = trimmed.IndexOf('{');
        var close = trimmed.LastIndexOf('}');
        if (open < 0 || close <= open) throw new RuleException("The AI provider did not return a JSON review.", 502);
        return trimmed[open..(close + 1)];
    }
}
