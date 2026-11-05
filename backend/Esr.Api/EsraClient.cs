using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
namespace Esr.Api;

/// <summary>Calls whatever OpenAI-compatible endpoint the deployment configured. The browser never sees the credential.</summary>
public sealed class EsraClient(HttpClient http, IOptions<EsrAiOptions> settings)
{
    readonly EsrAiOptions options = settings.Value;
    public bool Enabled => options.Enabled;
    public async Task<EsraReviewResult> Review(EsrRecord current, IReadOnlyList<EsrRecord> others, CancellationToken cancellationToken)
    {
        if (!options.Enabled) throw new RuleException("Esra AI is not configured. Set EsrAi:BaseUrl and EsrAi:Model for this deployment.", 503);
        var root = options.BaseUrl.TrimEnd('/') + "/";
        var path = string.IsNullOrWhiteSpace(options.CompletionsPath) ? "chat/completions" : options.CompletionsPath.TrimStart('/');
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(root), path));
        if (!string.IsNullOrWhiteSpace(options.ApiKey))
        {
            var value = string.IsNullOrWhiteSpace(options.AuthScheme) ? options.ApiKey : $"{options.AuthScheme} {options.ApiKey}";
            request.Headers.TryAddWithoutValidation(string.IsNullOrWhiteSpace(options.AuthHeader) ? "Authorization" : options.AuthHeader, value);
        }
        request.Content = new StringContent(new JsonObject
        {
            ["model"] = options.Model,
            ["temperature"] = 0,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = EsraReview.SystemPrompt },
                new JsonObject { ["role"] = "user", ["content"] = EsraReview.Prompt(current, others) },
            },
        }.ToJsonString(), Encoding.UTF8, "application/json");
        HttpResponseMessage response;
        try { response = await http.SendAsync(request, cancellationToken); }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { throw new RuleException("Esra AI could not reach the configured provider.", 502); }
        using (response)
        {
            if (!response.IsSuccessStatusCode) throw new RuleException("The AI provider rejected the Esra request.", 502);
            JsonNode? body;
            try { body = JsonNode.Parse(await response.Content.ReadAsStringAsync(cancellationToken)); }
            catch (JsonException) { throw new RuleException("The AI provider returned an unreadable response.", 502); }
            string? content;
            try { content = body?["choices"]?[0]?["message"]?["content"]?.GetValue<string>(); }
            catch (InvalidOperationException) { content = null; }
            if (string.IsNullOrWhiteSpace(content)) throw new RuleException("The AI provider returned an unreadable response.", 502);
            return EsraReview.Parse(content, current, others);
        }
    }
}
