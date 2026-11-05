using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Xunit;
namespace Esr.Tests;
public sealed class ApiTests : IClassFixture<CracnFactory>
{
    readonly HttpClient client;
    public ApiTests(CracnFactory factory) => client = factory.CreateClient();
    async Task SignIn(string id)
    {
        var response = await client.PostAsJsonAsync("/api/demo/session", new { userId = id }); var session = await response.Content.ReadFromJsonAsync<JsonObject>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!["token"]!.GetValue<string>());
    }
    [Fact] public async Task HealthDoesNotRequireIdentity()
    {
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/bootstrap")).StatusCode);
    }
    [Fact] public async Task ApiRejectsUnauthorizedTransitionsAndServesApprovedPdf()
    {
        await SignIn("requestor");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/records/demo-2/assign", new { engineerId = "engineer" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync("/api/records/demo-1/pdf")).StatusCode);
        var pdf = await client.GetAsync("/api/records/demo-4/pdf"); Assert.Equal("application/pdf", pdf.Content.Headers.ContentType!.MediaType); Assert.True((await pdf.Content.ReadAsByteArrayAsync()).Length > 500);
    }
    static object NewRequest(string jcn) => new { title = "CRACN request", name = "Alex Morgan", shop = "31", phone = "555-0131", references = "DEMO-1", condition = "Coupling wear", jcn };
    [Fact] public async Task LdsAndSearchReturnMockData()
    {
        await SignIn("engineer");
        var lds = await client.GetFromJsonAsync<JsonObject>("/api/lds?jcn=21036WX010184"); Assert.Contains("TSN", lds!["component"]!.GetValue<string>());
        Assert.Equal("VLV-214 / TSN-20871", (await client.GetFromJsonAsync<JsonObject>("/api/lds?jcn=21036WX020207"))!["component"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/lds?jcn=unknown")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/lds?jcn=00000ZZZZ0001")).StatusCode);
        var search = await client.PostAsJsonAsync("/api/history/search", new { condition = "Uneven pump coupling wear" }); var result = await search.Content.ReadFromJsonAsync<JsonObject>(); Assert.NotEmpty(result!["matches"]!.AsArray());
    }
    [Fact] public async Task AttachmentRetainsOriginal()
    {
        await SignIn("engineer");
        var response = await client.PostAsJsonAsync("/api/records/demo-1/attach", new { name = "inspection.txt", type = "text/plain", section = "Continuation", base64 = Convert.ToBase64String("Synthetic inspection record"u8.ToArray()) });
        response.EnsureSuccessStatusCode(); var r = await response.Content.ReadFromJsonAsync<JsonObject>(); var file = r!["attachments"]!.AsArray().Last()!;
        Assert.Equal("", file["base64"]!.GetValue<string>()); Assert.Equal("Synthetic inspection record", await client.GetStringAsync($"/api/records/demo-1/files/{file["id"]!.GetValue<string>()}"));
    }
    [Fact] public async Task CreatedRecordStoresCracnContext()
    {
        await SignIn("requestor");
        // 71204POAH7469 exists only in the generated CRACN data, never in seed.json.
        var generated = await (await client.PostAsJsonAsync("/api/records", NewRequest("71204POAH7469"))).Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("71204POAH7469", generated!["jcn"]!.GetValue<string>());
        Assert.NotEqual("", generated["workStatement"]!.GetValue<string>());
        var demo = await (await client.PostAsJsonAsync("/api/records", NewRequest("21036WX010184"))).Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("A014", demo!["refit"]!.GetValue<string>());
        Assert.Equal("ASW-P-02 / TSN-10482", demo["component"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/records", NewRequest("00000ZZZZ0001"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/records", NewRequest("JCN-260184"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/records", NewRequest("N/A"))).StatusCode);
    }
}
