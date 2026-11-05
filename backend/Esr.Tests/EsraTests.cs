using System.Net;
using System.Text.Json.Nodes;
using Esr.Api;
using Microsoft.Extensions.Options;
using Xunit;
namespace Esr.Tests;
public sealed class EsraTests
{
    static EsrRecord Record(string id, string title) => new() { Id = id, Title = title, Serial = "260001", Status = "ESR Closed", Condition = title, Resolution = "Restore." };
    [Fact]
    public void PromptOmitsAttachmentBytes()
    {
        var current = new EsrRecord { Id = "demo-1", Title = "Pump", Condition = "Wear", Attachments = [new() { Base64 = "SECRET-BYTES" }] };
        Assert.DoesNotContain("SECRET-BYTES", EsraReview.Prompt(current, []));
    }
    [Fact]
    public void ParseKeepsKnownRecordsAndClampsSimilarity()
    {
        var current = Record("demo-1", "Current");
        var other = Record("demo-5", "Coupling wear");
        var review = EsraReview.Parse("""
            Here is the review:
            ```json
            {"summary":"The coupling wear may repeat a closed ESR.","matches":[{"id":"demo-5","similarity":140,"reason":"Same wear"},{"id":"missing","similarity":90,"reason":"Unknown"},{"id":"demo-1","similarity":99,"reason":"Itself"}]}
            ```
            """, current, [current, other]);
        Assert.Equal("The coupling wear may repeat a closed ESR.", review.Summary);
        var match = Assert.Single(review.Matches);
        Assert.Equal("demo-5", match.Id); Assert.Equal(100, match.Similarity); Assert.Equal("Same wear", match.Reason);
    }
    [Fact]
    public async Task ClientSendsTheConfiguredCredentialAndModel()
    {
        HttpRequestMessage? captured = null;
        var sent = "";
        var handler = new StubHandler(async request =>
        {
            captured = request;
            sent = await request.Content!.ReadAsStringAsync();
            var body = new JsonObject { ["choices"] = new JsonArray { new JsonObject { ["message"] = new JsonObject { ["content"] = """{"summary":"Possible duplicate.","matches":[{"id":"demo-5","similarity":82,"reason":"Shared condition"}]}""" } } } };
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body.ToJsonString()) };
        });
        var options = Options.Create(new EsrAiOptions { BaseUrl = "http://127.0.0.1:11434/v1", ApiKey = "local-key", Model = "local-agent", AuthHeader = "Authorization", AuthScheme = "Bearer" });
        var client = new EsraClient(new HttpClient(handler), options);
        var review = await client.Review(Record("demo-1", "Current"), [Record("demo-5", "Coupling wear")], CancellationToken.None);
        Assert.Equal("http://127.0.0.1:11434/v1/chat/completions", captured!.RequestUri!.ToString());
        Assert.Equal("Bearer local-key", captured.Headers.GetValues("Authorization").Single());
        Assert.Contains("\"model\":\"local-agent\"", sent);
        Assert.Equal(82, Assert.Single(review.Matches).Similarity);
    }
    sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => respond(request);
    }
}
