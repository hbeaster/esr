using System.Text.Json;
using System.Text.Json.Nodes;
using Esr.Api;
using Xunit;
namespace Esr.Tests;
public sealed class WorkflowTests
{
    readonly Workflow w = new(JsonSerializer.Deserialize<StoreData>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "test-data.json")), JsonConfig.Options)!);
    Actor User(string id) => w.Data.Users.First(u => u.Id == id);
    static JsonObject D(string json) => JsonNode.Parse(json)!.AsObject();
    EsrRecord Create() => w.Create(User("requestor"), D("""{"title":"Test request","name":"Alex Morgan","shop":"31","phone":"555-0131","references":"DEMO-1","condition":"Coupling wear","jcn":"N/A"}"""));
    static JsonObject Request(string jcn) => D($$"""{"title":"Test request","name":"Alex Morgan","shop":"31","phone":"555-0131","references":"DEMO-1","condition":"Coupling wear","jcn":"{{jcn}}"}""");
    [Fact] public void CreateCopiesCracnContextForJcn()
    {
        var lds = new LdsData { WorkStatement = "Inspect coupling", Refit = "A014", Component = "ASW-P-02 / TSN-10482", Location = "Auxiliary machinery space" };
        var r = w.Create(User("requestor"), Request("21036WX010184"), lds);
        Assert.Equal(("Inspect coupling", "A014", "ASW-P-02 / TSN-10482", "Auxiliary machinery space"), (r.WorkStatement, r.Refit, r.Component, r.Location));
    }
    [Theory]
    [InlineData("12345WX019999")] [InlineData("1234512980001")] [InlineData(" 21036wx010184 ")]
    public void JcnAcceptsFiveDigitsFourAlphanumericsAndSequence(string jcn) => Assert.Matches("^[0-9]{5}[A-Z0-9]{4}[0-9]{4}$", Workflow.Jcn(jcn));
    [Theory]
    [InlineData("JCN-260184")] [InlineData("1234WX019999")] [InlineData("12345WX0199999")] [InlineData("A2345WX019999")] [InlineData("12345WX01999A")] [InlineData("12345WX010000")] [InlineData("12345W-019999")]
    public void JcnRejectsMalformedValues(string jcn) => Assert.Equal(400, Assert.Throws<RuleException>(() => Workflow.Jcn(jcn)).Status);
    [Fact] public void CreateNormalizesAndValidatesJcn()
    {
        var lds = new LdsData { Refit = "A014" }; var count = w.Data.Records.Count;
        Assert.Equal("21036WX010184", w.Create(User("requestor"), Request("21036wx010184"), lds).Jcn);
        Assert.Equal(400, Assert.Throws<RuleException>(() => w.Create(User("requestor"), Request("JCN-260184"), lds)).Status);
        Assert.Equal(count + 1, w.Data.Records.Count);
    }
    [Fact] public void CreateRejectsJcnWithoutCracnContext()
    {
        var count = w.Data.Records.Count;
        Assert.Equal(400, Assert.Throws<RuleException>(() => w.Create(User("requestor"), Request("21036WX010184"))).Status);
        Assert.Equal(count, w.Data.Records.Count);
        Assert.Equal("", w.Create(User("requestor"), Request("N/A"), new LdsData { Refit = "A014" }).Refit);
    }
    EsrRecord Draft()
    {
        var r = Create(); w.Execute(User("supervisor"), r.Id, "assign", D("""{"engineerId":"engineer"}"""));
        return w.Execute(User("engineer"), r.Id, "draft", D("""{"resolution":"Inspect and restore.","rationale":"Approved criteria.","dfs":"no","tvd":"no","attributes":["SUBSAFE"]}"""))!;
    }
    EsrRecord Issue()
    {
        var r = Draft(); w.Execute(User("engineer"), r.Id, "resolve", new());
        return w.Execute(User("supervisor"), r.Id, "approve", new())!;
    }
    [Fact] public void WorkflowCompletesThroughFourDistinctSignatures()
    {
        var r = Issue(); r = w.Execute(User("shop"), r.Id, "complete", D("""{"status":"Completed","shop":"31"}"""))!;
        r = w.Execute(User("division"), r.Id, "close", new())!;
        Assert.Equal("ESR Closed", r.Status); Assert.Equal(4, r.Signatures.Count); Assert.Equal(4, r.Signatures.Select(s => s.UserId).Distinct().Count());
    }
    [Fact] public void FailedDraftValidationIsAtomic()
    {
        var r = Draft(); var before = JsonSerializer.Serialize(r); Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "draft", D("""{"resolution":"changed","attributes":["INVALID"]}""")));
        Assert.Equal(before, JsonSerializer.Serialize(w.Find(User("engineer"), r.Id)));
    }
    [Theory] [InlineData("Deferred")] [InlineData("Other")] [InlineData("Canceled")]
    public void NonCompletedDispositionsRequireExplanation(string status)
    {
        var r = Issue(); var data = new JsonObject { ["status"] = status, ["shop"] = "31" }; Assert.Throws<RuleException>(() => w.Execute(User("shop"), r.Id, "complete", data));
        data["explanation"] = "Awaiting scheduled availability."; r = w.Execute(User("shop"), r.Id, "complete", data)!;
        Assert.Equal(status == "Deferred" ? "ESR Issued – Deferred" : "ESR Issued", r.Status);
        if (status == "Deferred") Assert.Throws<RuleException>(() => w.Execute(User("division"), r.Id, "close", new()));
    }
    [Fact] public void IssuedContentIsLockedAndRevisionRetainsIndependentSnapshot()
    {
        var r = Issue(); Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "draft", new()));
        var original = r.Resolution; r = w.Execute(User("engineer"), r.Id, "revise", D("""{"reason":"Updated inspection requirements"}"""))!;
        Assert.EndsWith("B", r.Serial); Assert.EndsWith("A", r.Revisions[0].Serial); Assert.Equal(original, r.Resolution); Assert.Empty(r.Signatures); Assert.Equal(2, r.Revisions[0].Signatures.Count);
        r = w.Execute(User("engineer"), r.Id, "draft", D("""{"resolution":"Changed", "rationale":"Changed", "dfs":"no", "tvd":"no"}"""))!; Assert.Equal(original, r.Revisions[0].Resolution);
    }
    [Theory] [InlineData(1,"A")] [InlineData(26,"Z")] [InlineData(27,"AA")] [InlineData(702,"ZZ")]
    public void RevisionSuffixBounds(int number, string suffix) => Assert.Equal(suffix, Workflow.RevisionSuffix(number));
    [Fact] public void RevisionOverflowRejected() => Assert.Throws<RuleException>(() => Workflow.RevisionSuffix(703));
    [Fact] public void AssignmentIssuesYearSequenceAndRevisionA()
    {
        w.Data.SequenceYear = DateTime.UtcNow.Year; w.Data.Sequence = 0;
        var r = w.Execute(User("supervisor"), Create().Id, "assign", D("""{"engineerId":"engineer"}"""))!;
        Assert.Equal($"{DateTime.UtcNow:yy}0001A", r.Serial); Assert.Equal($"{DateTime.UtcNow:yy}0001", r.SerialBase); Assert.Equal(1, r.Revision);
    }
    [Fact] public void SequenceRestartsWhenTheYearChanges()
    {
        w.Data.SequenceYear = DateTime.UtcNow.Year - 1; w.Data.Sequence = 9999;
        var r = w.Execute(User("supervisor"), Create().Id, "assign", D("""{"engineerId":"engineer"}"""))!;
        Assert.Equal($"{DateTime.UtcNow:yy}0001A", r.Serial); Assert.Equal(DateTime.UtcNow.Year, w.Data.SequenceYear); Assert.Equal(1, w.Data.Sequence);
    }
    [Fact] public void AnnualSequenceStopsAt9999()
    {
        w.Data.SequenceYear = DateTime.UtcNow.Year; w.Data.Sequence = 9999; var r = Create();
        Assert.Contains("Annual serial limit", Assert.Throws<RuleException>(() => w.Execute(User("supervisor"), r.Id, "assign", D("""{"engineerId":"engineer"}"""))).Message);
    }
    [Fact] public void LastRevisionUsesZZ()
    {
        var r = Issue(); r.Revision = 701; r.Serial = r.SerialBase + "ZY";
        r = w.Execute(User("engineer"), r.Id, "revise", D("""{"reason":"Final suffix"}"""))!;
        Assert.Equal(r.SerialBase + "ZZ", r.Serial); Assert.Equal(702, r.Revision);
    }
    [Fact] public void RevisionPastZZIsRejected()
    {
        var r = Issue(); r.Revision = 702; r.Serial = r.SerialBase + "ZZ";
        Assert.Contains("Revision limit", Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "revise", D("""{"reason":"Past the end"}"""))).Message);
    }
    [Fact] public void DfsReferenceRequiredBeforeSigning()
    {
        var r = Draft(); w.Execute(User("engineer"), r.Id, "draft", D("""{"resolution":"Inspect","rationale":"Criteria","dfs":"yes","tvd":"no"}"""));
        Assert.Contains("DFS reference", Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "resolve", new())).Message);
    }
    [Fact] public void CrossFacilityReviewCannotModifyOrSign()
    {
        var r = Draft(); Assert.Empty(w.Visible(User("remote")));
        w.SetPermission(User("admin"), D("""{"userId":"remote","crossSite":"read"}""")); Assert.NotEmpty(w.Visible(User("remote")));
        Assert.Throws<RuleException>(() => w.Execute(User("remote"), r.Id, "comment", D("""{"text":"Review"}""")));
        w.SetPermission(User("admin"), D("""{"userId":"remote","crossSite":"review","dualSign":true}"""));
        w.Execute(User("remote"), r.Id, "comment", D("""{"text":"Review"}""")); Assert.Throws<RuleException>(() => w.Execute(User("remote"), r.Id, "resolve", new()));
    }
    [Fact] public void DualSignatureRequiresDelegationAndComment()
    {
        var r = Draft(); w.Execute(User("engineer"), r.Id, "resolve", new()); Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "approve", new()));
        w.SetPermission(User("admin"), D("""{"userId":"engineer","crossSite":"none","dualSign":true}""")); Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "approve", new()));
        r = w.Execute(User("engineer"), r.Id, "approve", D("""{"comment":"Delegated approval"}"""))!; Assert.Equal("ESR Issued", r.Status);
    }
    [Fact] public void OptimisticConcurrencyRejectsStaleWrites()
    {
        var r = Draft(); Assert.Throws<RuleException>(() => w.Execute(User("engineer"), r.Id, "comment", new JsonObject { ["version"] = r.Version - 1, ["text"] = "Stale" }));
    }
    [Fact] public void IdentityCannotBeSpoofedByPayload()
    {
        var r = Draft(); r = w.Execute(User("engineer"), r.Id, "resolve", D("""{"name":"Someone else","userId":"supervisor"}"""))!;
        Assert.Equal("engineer", r.Signatures.Single().UserId); Assert.Equal("Jordan Lee", r.Signatures.Single().Name);
    }
    [Fact] public void JwtTamperingIsRejected()
    {
        var auth = new DemoIdentity(); var token = auth.Issue(User("engineer")); Assert.Equal("engineer", auth.Validate(token, w.Data.Users).Id);
        Assert.Throws<RuleException>(() => auth.Validate(token + "x", w.Data.Users));
    }
    [Fact] public void PdfIncludesHeaderAndAudit()
    {
        var r = Issue(); var bytes = PdfExport.Generate(r); var text = System.Text.Encoding.ASCII.GetString(bytes);
        Assert.StartsWith("%PDF-1.7", text); Assert.Contains(r.Serial!, text); Assert.Contains("SUBSAFE", text); Assert.Contains("Resolved By", text); Assert.EndsWith("%%EOF\n", text);
    }
    [Fact] public void SupervisorCanReturnAndRequestorCanResubmit()
    {
        var r = Create(); r = w.Execute(User("supervisor"), r.Id, "reject", D("""{"comment":"More detail required"}"""))!; Assert.True(r.Rejected);
        r = w.Execute(User("requestor"), r.Id, "resubmit", D("""{"condition":"Expanded finding"}"""))!; Assert.False(r.Rejected); Assert.Single(r.Comments);
    }
    [Fact] public void PdfRendersPngContinuationAndEmbedsOriginal()
    {
        var r = Issue();
        r.Attachments.Add(new() { Name = "inspection.png", Type = "image/png", Section = "Continuation", Base64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNBgAAEnICff5q7YNAAAAAElFTkSuQmCC", Size = 75 });
        var text = System.Text.Encoding.ASCII.GetString(PdfExport.Generate(r));
        Assert.Contains("/Subtype /Image", text); Assert.Contains("/Type /EmbeddedFile", text); Assert.Contains("CONTINUATION IMAGE", text);
    }

}
