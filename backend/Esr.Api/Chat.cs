using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
namespace Esr.Api;

public sealed record ChatTurn(string Role, string Content);
public sealed record ChatCompletion(string Reply, string Model, bool Mock);

/// <summary>Generates the next assistant turn. The API key never leaves the server.</summary>
public interface IChatModel
{
    Task<ChatCompletion> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken);
}

/// <summary>
/// Binds the "Chat" configuration section. Any OpenAI-compatible Chat Completions endpoint works:
/// OpenAI (default), Azure OpenAI, Anthropic's OpenAI SDK compatibility endpoint, OpenRouter, Ollama, and similar.
/// Set Chat__ApiKey to enable it; without a key the API answers with a labeled mock.
/// </summary>
public sealed class ChatOptions
{
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "gpt-4o-mini";
    public int TimeoutSeconds { get; set; } = 60;
    public bool Configured => !string.IsNullOrWhiteSpace(ApiKey);

    public void Apply(HttpClient client)
    {
        client.BaseAddress = new Uri(BaseUrl.TrimEnd('/') + "/");
        client.Timeout = TimeSpan.FromSeconds(TimeoutSeconds);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ApiKey.Trim());
    }
}

/// <summary>Calls POST {BaseUrl}/chat/completions with only the widely supported fields.</summary>
public sealed class OpenAiCompatibleChat(HttpClient http, ChatOptions options) : IChatModel
{
    public async Task<ChatCompletion> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken)
    {
        var body = new JsonObject
        {
            ["model"] = options.Model,
            ["messages"] = new JsonArray(messages.Select(m => (JsonNode)new JsonObject { ["role"] = m.Role, ["content"] = m.Content }).ToArray()),
        };
        HttpResponseMessage response;
        try { response = await http.PostAsJsonAsync("chat/completions", body, cancellationToken); }
        catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        { throw new RuleException("The chat provider is unreachable. Try again shortly.", 502); }
        using (response)
        {
            // Provider error bodies can echo key fragments, so only the status reaches the client.
            if (!response.IsSuccessStatusCode) throw new RuleException(response.StatusCode switch
            {
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "The chat provider rejected the configured API key.",
                HttpStatusCode.TooManyRequests => "The chat provider is rate limited or out of quota.",
                HttpStatusCode.NotFound => "The chat provider does not recognize the configured model or base URL.",
                _ => $"The chat provider failed ({(int)response.StatusCode}).",
            }, 502);
            var json = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken);
            var reply = json?["choices"]?[0]?["message"]?["content"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(reply)) throw new RuleException("The chat provider returned an empty reply.", 502);
            return new ChatCompletion(reply.Trim(), json?["model"]?.GetValue<string>() ?? options.Model, false);
        }
    }
}

/// <summary>Deterministic stand-in used when no API key is configured. Labeled as a mock in the UI.</summary>
public sealed class MockChatModel : IChatModel
{
    public Task<ChatCompletion> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken)
    {
        var question = messages[^1].Content;
        var reply = $"Mock assistant (no API key configured). You asked: \"{question[..Math.Min(question.Length, 160)]}\". " +
            "Set Chat__ApiKey on the API to get real answers. Verify any suggestion against the referenced specifications before using it.";
        return Task.FromResult(new ChatCompletion(reply, "mock", true));
    }
}

public static class AssistantChat
{
    public const int MaxTurns = 20, MaxLength = 4000;

    /// <summary>Validates the client transcript. Only user and assistant turns are accepted; the system prompt is server-owned.</summary>
    public static List<ChatTurn> Parse(JsonObject d)
    {
        var items = d["messages"] as JsonArray;
        Workflow.Require(items is { Count: > 0 }, "messages is required.");
        Workflow.Require(items!.Count <= MaxTurns, $"A conversation is limited to {MaxTurns} messages. Clear the chat to continue.");
        var turns = items.Select(i =>
        {
            var role = i?["role"] is JsonValue r && r.TryGetValue<string>(out var rs) ? rs : "";
            var content = i?["content"] is JsonValue c && c.TryGetValue<string>(out var cs) ? cs.Trim() : "";
            Workflow.Require(role is "user" or "assistant", "Message role must be user or assistant.");
            Workflow.Require(content.Length is > 0 and <= MaxLength, $"Each message must be 1 to {MaxLength} characters.");
            return new ChatTurn(role, content);
        }).ToList();
        Workflow.Require(turns[^1].Role == "user", "The last message must come from the user.");
        return turns;
    }

    /// <summary>Grounds the model in the active ESR and its closest historical matches.</summary>
    public static string SystemPrompt(EsrRecord r, IEnumerable<HistoricalMatch> matches)
    {
        var s = new StringBuilder();
        s.AppendLine("You are an engineering assistant for a Trident Refit Facility engineer drafting the resolution and rationale of an Engineering Service Request (ESR).");
        s.AppendLine("Give concise, technically careful suggestions. Say when information is missing. Never invent specification, drawing, DFS, or TVD numbers. The engineer verifies and signs everything; your output is a draft.");
        s.AppendLine("Format replies in Markdown: short paragraphs, numbered lists for steps, bullet lists for options, bold for key terms, and tables only for comparisons. Do not include images or HTML.");
        s.AppendLine().AppendLine("Active ESR:");
        // Condition, references, resolution, and rationale are stored as rich-text HTML; send the model plain text.
        void Line(string label, string? value) { var text = Workflow.VisibleText(value ?? ""); if (!string.IsNullOrWhiteSpace(text)) s.AppendLine($"- {label}: {text}"); }
        Line("Title", r.Title); Line("Condition / finding", r.Condition); Line("References", r.References); Line("JCN", r.Jcn);
        Line("Work statement", r.WorkStatement); Line("Component", r.Component); Line("Location", r.Location);
        Line("Current draft resolution", r.Resolution); Line("Current draft rationale", r.Rationale);
        var list = matches.Where(m => m.Similarity > 0).ToList();
        if (list.Count > 0)
        {
            s.AppendLine().AppendLine("Similar closed ESRs (term-overlap search):");
            foreach (var m in list) s.AppendLine($"- {m.Serial} \"{m.Title}\" ({m.Similarity}% similar). Resolution: {Workflow.VisibleText(m.Resolution)} Rationale: {Workflow.VisibleText(m.Rationale)}");
        }
        return s.ToString();
    }
}
