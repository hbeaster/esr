namespace Esr.Api;

/// <summary>
/// OpenAI-compatible chat settings. Leave <see cref="BaseUrl"/> empty to disable Esra.
/// Commercial APIs and local agents both use this shape; only the URL, model, and credential change.
/// </summary>
public sealed class EsrAiOptions
{
    public const string Section = "EsrAi";
    public string BaseUrl { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "";
    public string CompletionsPath { get; set; } = "chat/completions";
    public string AuthHeader { get; set; } = "Authorization";
    /// <summary>Set to an empty string to send <see cref="ApiKey"/> as the raw header value.</summary>
    public string AuthScheme { get; set; } = "Bearer";
    public bool Enabled => Uri.TryCreate(BaseUrl, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(Model);
}
