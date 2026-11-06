using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
namespace Esr.Tests;

/// <summary>The dev-only sandbox that lets "Use fake data" run the real workflow.</summary>
public sealed class SimulatedSandboxTests
{
    static WebApplicationFactory<Program> Factory(string environment, bool flag) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment(environment);
            if (flag) b.UseSetting("Demo:AcceptSimulatedData", "true");
        });
    static async Task SignIn(HttpClient client, string id)
    {
        var session = await (await client.PostAsJsonAsync("/api/demo/session", new { userId = id })).Content.ReadFromJsonAsync<JsonObject>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!["token"]!.GetValue<string>());
    }
    static string Year => DateTime.UtcNow.ToString("yy");
    static object Record(string id, string status, string? serialBase, string? engineerId) => new
    {
        id, title = $"Simulated {id}", name = "Alex Morgan", shop = "31", phone = "555-0131", references = "SIM-REF", condition = "Simulated coupling wear",
        jcn = "N/A", site = "Bangor", requestorId = "requestor", status, serialBase, serial = serialBase is null ? null : $"{serialBase}A",
        revision = serialBase is null ? 0 : 1, engineerId, version = 3,
    };

    [Theory, InlineData("Production", true), InlineData("Testing", false), InlineData("Development", false)]
    public async Task SandboxIsAbsentUnlessDevelopmentOrTestingAndFlagged(string environment, bool flag)
    {
        await using var factory = Factory(environment, flag);
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/demo/simulated")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/demo/simulated", new { records = Array.Empty<object>() })).StatusCode);
    }

    [Fact] public async Task LoadedRecordsRunTheRealWorkflowAndContinueNumbering()
    {
        await using var factory = Factory("Testing", flag: true);
        var client = factory.CreateClient();
        Assert.False((await client.GetFromJsonAsync<JsonObject>("/api/demo/simulated"))!["loaded"]!.GetValue<bool>());
        var load = await client.PostAsJsonAsync("/api/demo/simulated", new
        {
            records = new[] { Record("sim-1", "Unassigned", null, null), Record("sim-2", "In Process", $"{Year}5003", "engineer") },
            templates = Array.Empty<object>(),
        });
        Assert.Equal(HttpStatusCode.OK, load.StatusCode);
        Assert.Equal(5003, (await load.Content.ReadFromJsonAsync<JsonObject>())!["sequence"]!.GetValue<int>());
        Assert.True((await client.GetFromJsonAsync<JsonObject>("/api/demo/simulated"))!["loaded"]!.GetValue<bool>());

        // Assignment allocates the next number after the simulated ones.
        await SignIn(client, "supervisor");
        var assigned = await (await client.PostAsJsonAsync("/api/records/sim-1/assign", new { engineerId = "engineer" })).Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal($"{Year}5004A", assigned!["serial"]!.GetValue<string>());

        // The engineer signs and submits a simulated record; Workflow.cs enforces the rules.
        await SignIn(client, "engineer");
        var draft = await client.PostAsJsonAsync("/api/records/sim-2/draft", new { resolution = "Restore the coupling.", rationale = "Meets criteria.", dfs = "no", dfsReference = "", tvd = "no", tvdReference = "", attributes = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.OK, draft.StatusCode);
        var resolved = await (await client.PostAsJsonAsync("/api/records/sim-2/resolve", new { })).Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("Awaiting Approval", resolved!["status"]!.GetValue<string>());
        Assert.Equal("Jordan Lee", resolved["signatures"]!.AsArray().Last()!["name"]!.GetValue<string>());

        // A rule still applies: the requestor cannot approve.
        await SignIn(client, "requestor");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/records/sim-2/approve", new { })).StatusCode);
    }
}
