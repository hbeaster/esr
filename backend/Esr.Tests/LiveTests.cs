using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;
namespace Esr.Tests;

/// <summary>Server-sent record changes and presence on GET /api/events.</summary>
public sealed class LiveTests
{
    static async Task<string> Token(HttpClient client, string id)
    {
        var session = await (await client.PostAsJsonAsync("/api/demo/session", new { userId = id })).Content.ReadFromJsonAsync<JsonObject>();
        return session!["token"]!.GetValue<string>();
    }
    static HttpClient As(WebApplicationFactory<Program> factory, string token)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>Reads named SSE frames from an open stream.</summary>
    sealed class EventStream(HttpResponseMessage response, StreamReader reader) : IAsyncDisposable
    {
        public static async Task<EventStream> Open(HttpClient client)
        {
            var response = await client.GetAsync("/api/events", HttpCompletionOption.ResponseHeadersRead);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("text/event-stream", response.Content.Headers.ContentType?.MediaType);
            return new(response, new StreamReader(await response.Content.ReadAsStreamAsync()));
        }
        /// <summary>The next frame with this name that matches, skipping others.</summary>
        public async Task<JsonObject> Next(string name, Func<JsonObject, bool>? match = null)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            string? eventName = null;
            while (true)
            {
                var line = await reader.ReadLineAsync(timeout.Token) ?? throw new InvalidOperationException("Stream ended.");
                if (line.StartsWith("event: ", StringComparison.Ordinal)) eventName = line[7..];
                else if (line.StartsWith("data: ", StringComparison.Ordinal) && eventName == name)
                {
                    var data = JsonNode.Parse(line[6..])!.AsObject();
                    if (match is null || match(data)) return data;
                }
            }
        }
        public async ValueTask DisposeAsync() { reader.Dispose(); response.Dispose(); await Task.CompletedTask; }
    }

    static object Request => new { name = "Alex Morgan", shop = "31", phone = "555-0131", references = "DEMO-1", condition = "Coupling wear", jcn = "N/A" };

    [Fact] public async Task StreamRequiresAValidToken()
    {
        await using var factory = new WebApplicationFactory<Program>();
        var response = await factory.CreateClient().GetAsync("/api/events");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact] public async Task CommittedChangesArePushedInOrder()
    {
        await using var factory = new WebApplicationFactory<Program>(); var anon = factory.CreateClient();
        var engineer = As(factory, await Token(anon, "engineer"));
        await using var stream = await EventStream.Open(engineer);
        Assert.False(string.IsNullOrEmpty((await stream.Next("hello"))["connectionId"]!.GetValue<string>()));

        var requestor = As(factory, await Token(anon, "requestor"));
        var created = await (await requestor.PostAsJsonAsync("/api/records", Request)).Content.ReadFromJsonAsync<JsonObject>();
        var id = created!["id"]!.GetValue<string>();
        var supervisor = As(factory, await Token(anon, "supervisor"));
        await supervisor.PostAsJsonAsync($"/api/records/{id}/assign", new { engineerId = "engineer" });

        var create = await stream.Next("record-changed");
        Assert.Equal(id, create["id"]!.GetValue<string>());
        Assert.Equal("create", create["action"]!.GetValue<string>());
        Assert.Equal("Alex Morgan", create["actor"]!.GetValue<string>());
        var assign = await stream.Next("record-changed");
        Assert.Equal("assign", assign["action"]!.GetValue<string>());
        Assert.Equal("In Process", assign["status"]!.GetValue<string>());
        Assert.True(assign["version"]!.GetValue<int>() > create["version"]!.GetValue<int>());
    }

    [Fact] public async Task RejectedActionsAreNotPushed()
    {
        await using var factory = new WebApplicationFactory<Program>(); var anon = factory.CreateClient();
        var requestor = As(factory, await Token(anon, "requestor"));
        var created = await (await requestor.PostAsJsonAsync("/api/records", Request)).Content.ReadFromJsonAsync<JsonObject>();
        var id = created!["id"]!.GetValue<string>();
        await using var stream = await EventStream.Open(As(factory, await Token(anon, "engineer")));
        await stream.Next("hello");
        // The requestor cannot assign: the stored record and the stream stay unchanged.
        Assert.Equal(HttpStatusCode.Forbidden, (await requestor.PostAsJsonAsync($"/api/records/{id}/assign", new { engineerId = "engineer" })).StatusCode);
        await requestor.PostAsJsonAsync($"/api/records/{id}/comment", new { text = "Follow-up" });
        Assert.Equal("comment", (await stream.Next("record-changed"))["action"]!.GetValue<string>());
    }

    [Fact] public async Task OtherFacilitiesDoNotReceiveChangesTheyCannotSee()
    {
        await using var factory = new WebApplicationFactory<Program>(); var anon = factory.CreateClient();
        await using var remote = await EventStream.Open(As(factory, await Token(anon, "remote")));
        await remote.Next("hello");
        var requestor = As(factory, await Token(anon, "requestor"));
        await requestor.PostAsJsonAsync("/api/records", Request);
        // Kings Bay has no cross-facility access, so its next frame is presence only, never the Bangor record.
        await using var bangor = await EventStream.Open(As(factory, await Token(anon, "engineer")));
        var presence = await remote.Next("presence", p => p["viewers"]!.AsArray().Count == 2);
        Assert.NotNull(presence);
        var admin = As(factory, await Token(anon, "admin"));
        await admin.PostAsJsonAsync("/api/permissions", new { userId = "remote", crossSite = "read", dualSign = false });
        var visible = await (await requestor.PostAsJsonAsync("/api/records", Request)).Content.ReadFromJsonAsync<JsonObject>();
        // The first frame Kings Bay gets is the record created after access was granted.
        Assert.Equal(visible!["id"]!.GetValue<string>(), (await remote.Next("record-changed"))["id"]!.GetValue<string>());
    }

    [Fact] public async Task PresenceIsSharedAndOnlyItsOwnerCanSetIt()
    {
        await using var factory = new WebApplicationFactory<Program>(); var anon = factory.CreateClient();
        var requestorToken = await Token(anon, "requestor");
        var requestor = As(factory, requestorToken);
        var created = await (await requestor.PostAsJsonAsync("/api/records", Request)).Content.ReadFromJsonAsync<JsonObject>();
        var id = created!["id"]!.GetValue<string>();

        var supervisor = As(factory, await Token(anon, "supervisor"));
        await using var watching = await EventStream.Open(supervisor);
        await watching.Next("hello");
        await using var viewer = await EventStream.Open(requestor);
        var connectionId = (await viewer.Next("hello"))["connectionId"]!.GetValue<string>();

        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.PostAsJsonAsync("/api/presence", new { connectionId, view = "record", recordId = id })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await requestor.PostAsJsonAsync("/api/presence", new { connectionId, view = "elsewhere" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await requestor.PostAsJsonAsync("/api/presence", new { connectionId, view = "record", recordId = id })).StatusCode);
        var presence = await watching.Next("presence", p => p["viewers"]!.AsArray().Any(v => v!["recordId"]?.GetValue<string>() == id));
        var entry = presence["viewers"]!.AsArray().First(v => v!["connectionId"]!.GetValue<string>() == connectionId)!;
        Assert.Equal("Alex Morgan", entry["name"]!.GetValue<string>());
        Assert.Equal("record", entry["view"]!.GetValue<string>());
    }

    [Fact] public async Task ClosingTheStreamRemovesPresence()
    {
        await using var factory = new WebApplicationFactory<Program>(); var anon = factory.CreateClient();
        await using var watching = await EventStream.Open(As(factory, await Token(anon, "supervisor")));
        await watching.Next("hello");
        var viewer = await EventStream.Open(As(factory, await Token(anon, "engineer")));
        await viewer.Next("hello");
        await watching.Next("presence", p => p["viewers"]!.AsArray().Count == 2);
        await viewer.DisposeAsync();
        await watching.Next("presence", p => p["viewers"]!.AsArray().Count == 1);
    }
}
