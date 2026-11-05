using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace Esr.Api;

/// <summary>Resolves a Job Control Number to the work context shown on a new ESR.</summary>
public interface ILdsSource
{
    Task<LdsData> Lookup(string jcn, CancellationToken cancellationToken);
}

/// <summary>Binds the "Cracn" configuration section, e.g. Cracn__BaseUrl=http://cracn-mock:4010.</summary>
public sealed class CracnOptions
{
    /// <summary>Defaults to the local mock started by `npm run dev:cracn`.</summary>
    public string BaseUrl { get; set; } = "http://127.0.0.1:4010";
    /// <summary>Service bearer token sent to CRACN. The mock accepts any non-empty token.</summary>
    public string Token { get; set; } = "esr-demo-service-token";
    public int TimeoutSeconds { get; set; } = 10;

    public void Apply(HttpClient client)
    {
        client.BaseAddress = new Uri(BaseUrl.TrimEnd('/') + "/");
        client.Timeout = TimeSpan.FromSeconds(TimeoutSeconds);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token);
    }
}

/// <summary>
/// Reads LDS context from the CRACN API (openapi.json): the Job gives the work
/// statement and refit; its configuration item gives the component and location.
/// </summary>
public sealed class CracnLdsSource(HttpClient http) : ILdsSource
{
    public async Task<LdsData> Lookup(string jcn, CancellationToken cancellationToken)
    {
        var job = await Get($"api/v1/jobs/{Uri.EscapeDataString(jcn)}", cancellationToken)
            ?? throw new RuleException($"JCN {jcn} was not found in CRACN. Check the number or select N/A.", 404);
        var refs = job["noncanonicalRefs"];
        var refit = refs?["refit"]?["uniqueness"];
        var item = refs?["configurationItem"]?["uniqueness"];
        string component = "", location = "";
        if (Text(item?["uic"]) is { } uic && Text(item?["hsc"]) is { } hsc)
        {
            var configurationItem = await Get($"api/v1/boats/{Uri.EscapeDataString(uic)}/configurationItems/{Uri.EscapeDataString(hsc)}", cancellationToken);
            component = string.Join(" / ", new[] { Text(configurationItem?["equipmentName"]), Text(configurationItem?["equipmentSerialNumber"]) ?? hsc }.Where(s => !string.IsNullOrWhiteSpace(s)));
            location = Text(configurationItem?["location"]) ?? "";
        }
        return new LdsData
        {
            WorkStatement = Text(job["csmpSummary"]) ?? Text(job["narrative"]) ?? "",
            Refit = Text(refit?["refitNumber"]) ?? "",
            Component = component,
            Location = location,
        };
    }

    async Task<JsonObject?> Get(string path, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await http.GetAsync(path, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode) throw new RuleException($"CRACN lookup failed ({(int)response.StatusCode}). Try again or select N/A.", 502);
            return await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken);
        }
        catch (Exception e) when (e is HttpRequestException or JsonException || (e is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            throw new RuleException("CRACN is unavailable. Try again or select N/A.", 502);
        }
    }

    static string? Text(JsonNode? node) => node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;
}
