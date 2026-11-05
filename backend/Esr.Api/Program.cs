using Esr.Api;
using System.Text.Json;
using System.Text.Json.Nodes;
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 22 * 1024 * 1024);
var seed = JsonSerializer.Deserialize<StoreData>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "seed.json")), JsonConfig.Options)!;
var workflow = new Workflow(seed); var identity = new DemoIdentity();
builder.Services.AddSingleton(workflow); builder.Services.AddSingleton(identity);
builder.Services.Configure<EsrAiOptions>(builder.Configuration.GetSection(EsrAiOptions.Section));
builder.Services.AddHttpClient<EsraClient>(client => client.Timeout = TimeSpan.FromSeconds(45));
var app = builder.Build();
app.Use(async (context, next) =>
{
    try
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
        await next();
    }
    catch (RuleException e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { error = e.Message }); }
    catch (Exception e) when (e is JsonException or InvalidOperationException or FormatException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "Malformed request." }); }
});
// Resolve static host files before endpoint routing selects the JSON fallback.
app.UseDefaultFiles(); app.UseStaticFiles(); app.UseRouting();
app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/ready", () => Results.Ok(new { status = "ready", mode = "synthetic" }));
app.MapGet("/api/demo/users", () => seed.Users);
app.MapPost("/api/demo/session", (JsonObject d) => { var user = seed.Users.Find(u => u.Id == d["userId"]?.GetValue<string>()) ?? throw new RuleException("Unknown demo identity."); return Results.Ok(new { user, token = identity.Issue(user) }); });
Actor User(HttpContext c) => identity.Validate(c.Request.Headers.Authorization.ToString().Replace("Bearer ", "", StringComparison.Ordinal), seed.Users);
app.MapGet("/api/bootstrap", (HttpContext c) => { var a = User(c); lock (workflow.Sync) return Results.Ok(new { user = a, users = seed.Users, templates = seed.Templates, permissions = seed.Permissions, records = workflow.Visible(a).Select(Workflow.Public).ToArray() }); });
app.MapGet("/api/lds", (HttpContext c, string jcn) => { User(c); return seed.Lds.TryGetValue(jcn, out var found) ? Results.Ok(found) : throw new RuleException("JCN not found. Try JCN-260184 or JCN-260207, or select N/A.", 404); });
app.MapPost("/api/history/search", (HttpContext c, JsonObject d) => { var a = User(c); lock (workflow.Sync) return Results.Ok(workflow.Search(a, d)); });
app.MapPost("/api/records/{id}/esra", async (HttpContext c, string id, EsraClient esra, CancellationToken ct) =>
{
    var a = User(c);
    if (!esra.Enabled) throw new RuleException("Esra AI is not configured. Set EsrAi:BaseUrl and EsrAi:Model for this deployment.", 503);
    EsrRecord current; List<EsrRecord> others;
    lock (workflow.Sync)
    {
        current = workflow.Find(a, id);
        others = workflow.Visible(a).Where(r => r.Id != id).OrderByDescending(r => r.Status == "ESR Closed").ThenByDescending(r => r.UpdatedAt).Take(12).ToList();
    }
    return Results.Ok(await esra.Review(current, others, ct));
});
app.MapPost("/api/permissions", (HttpContext c, JsonObject d) => { var a = User(c); lock (workflow.Sync) { workflow.SetPermission(a, d); return Results.Ok(seed.Permissions); } });
app.MapPost("/api/records", (HttpContext c, JsonObject d) => { var a = User(c); lock (workflow.Sync) return Results.Ok(Workflow.Public(workflow.Create(a, d))); });
app.MapGet("/api/records/{id}", (HttpContext c, string id) => { var a = User(c); lock (workflow.Sync) return Results.Ok(Workflow.Public(workflow.Find(a, id))); });
app.MapGet("/api/records/{id}/pdf", (HttpContext c, string id, int? revision) =>
{
    var a = User(c); lock (workflow.Sync) { var r = workflow.Find(a, id); if (revision is not null) r = r.Revisions.Find(x => x.Revision == revision) ?? throw new RuleException("Revision not found.", 404); Workflow.Require(r.Signatures.Any(s => s.Block == "Approved By"), "PDF is available after supervisor approval.", 409); return Results.File(PdfExport.Generate(r), "application/pdf", $"ESR-{r.Serial}.pdf"); }
});
app.MapGet("/api/records/{id}/files/{fileId}", (HttpContext c, string id, string fileId, int? revision) =>
{
    var a = User(c); lock (workflow.Sync) { var r = workflow.Find(a, id); if (revision is not null) r = r.Revisions.Find(x => x.Revision == revision) ?? throw new RuleException("Revision not found.", 404); var f = r.Attachments.Find(x => x.Id == fileId) ?? throw new RuleException("File not found.", 404); return Results.File(Convert.FromBase64String(f.Base64), f.Type); }
});
app.MapPost("/api/records/{id}/{action}", (HttpContext c, string id, string action, JsonObject d) => { var a = User(c); lock (workflow.Sync) { var result = workflow.Execute(a, id, action, d); return result is null ? Results.Ok(new { deleted = true }) : Results.Ok(Workflow.Public(result)); } });
app.MapFallback((HttpContext c) => { c.Response.StatusCode = 404; return Results.Json(new { error = "Route not found." }); });
app.Run();
public partial class Program { }
