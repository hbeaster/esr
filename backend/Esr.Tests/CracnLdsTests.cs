using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Esr.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Esr.Tests;

/// <summary>Serves CRACN resources from mocks/cracn/data.json by their metadata.name.</summary>
sealed class CracnDataHandler : HttpMessageHandler
{
    static readonly Lazy<Dictionary<string, JsonNode>> Resources = new(() =>
    {
        var data = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "cracn-data.json")))!["resources"]!.AsObject();
        var byName = new Dictionary<string, JsonNode>();
        foreach (var (_, value) in data)
            foreach (var node in value is JsonArray array ? array.ToArray() : [value])
                if (node?["metadata"]?["name"]?.GetValue<string>() is { } name) byName[name] = node;
        return byName;
    });
    public HttpStatusCode? Fail { get; init; }
    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        if (Fail is { } status) return Task.FromResult(new HttpResponseMessage(status));
        if (request.Headers.Authorization?.Scheme != "Bearer") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var name = Uri.UnescapeDataString(request.RequestUri!.AbsolutePath).TrimStart('/').Replace("api/v1/", "", StringComparison.Ordinal);
        return Task.FromResult(Resources.Value.TryGetValue(name, out var node)
            ? new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(node.ToJsonString(), Encoding.UTF8, "application/json") }
            : new HttpResponseMessage(HttpStatusCode.NotFound));
    }
}

public sealed class CracnLdsTests
{
    static CracnLdsSource Source(CracnDataHandler handler)
    {
        var client = new HttpClient(handler);
        new CracnOptions { BaseUrl = "http://cracn.test" }.Apply(client);
        return new CracnLdsSource(client);
    }

    [Fact] public async Task MapsJobRefitAndConfigurationItem()
    {
        var handler = new CracnDataHandler();
        var lds = await Source(handler).Lookup("JCN-260184", CancellationToken.None);
        Assert.Equal("Inspect auxiliary seawater pump coupling", lds.WorkStatement);
        Assert.Equal("A014", lds.Refit);
        Assert.Equal("ASW-P-02 / TSN-10482", lds.Component);
        Assert.Equal("Auxiliary machinery space", lds.Location);
        Assert.Equal(["/api/v1/jobs/JCN-260184", "/api/v1/boats/21036/configurationItems/6286FCA00000"], handler.Requests.Select(r => r.RequestUri!.AbsolutePath));
        Assert.All(handler.Requests, r => Assert.Equal("esr-demo-service-token", r.Headers.Authorization?.Parameter));
    }

    [Fact] public async Task UnknownJcnIsNotFound()
    {
        var error = await Assert.ThrowsAsync<RuleException>(() => Source(new CracnDataHandler()).Lookup("JCN-000000", CancellationToken.None));
        Assert.Equal(404, error.Status);
    }

    [Fact] public async Task UpstreamFailureIsBadGateway()
    {
        var error = await Assert.ThrowsAsync<RuleException>(() => Source(new CracnDataHandler { Fail = HttpStatusCode.InternalServerError }).Lookup("JCN-260184", CancellationToken.None));
        Assert.Equal(502, error.Status);
    }
}

/// <summary>The API wired to a CRACN stub that serves mocks/cracn/data.json.</summary>
public sealed class CracnFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.UseSetting("Cracn:BaseUrl", "http://cracn.test").ConfigureTestServices(s =>
            {
            s.AddHttpClient<ILdsSource, CracnLdsSource>().ConfigurePrimaryHttpMessageHandler(() => new CracnDataHandler());
            // Never spend a developer's real Chat__ApiKey from the test run.
            s.AddSingleton<IChatModel, MockChatModel>();
        });
}
