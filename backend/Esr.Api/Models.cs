using System.Text.Json;
namespace Esr.Api;

public static class JsonConfig
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static T Clone<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Options), Options)!;
}
public sealed class Actor
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Site { get; set; } = "";
    public string Shop { get; set; } = "";
    public string Phone { get; set; } = "";
}
public sealed class Evidence
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Block { get; set; } = "";
    public string Time { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string Comment { get; set; } = "";
    public string Text { get; set; } = "";
}
public sealed class AuditEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Actor { get; set; } = "";
    public string Time { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string Action { get; set; } = "";
}
public sealed class Attachment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Section { get; set; } = "";
    public string Base64 { get; set; } = "";
    public int Size { get; set; }
    public string UploadedBy { get; set; } = "";
    public string Time { get; set; } = DateTimeOffset.UtcNow.ToString("O");
}
public sealed class Completion
{
    public string Status { get; set; } = "";
    public string Explanation { get; set; } = "";
    public string Name { get; set; } = "";
    public string Shop { get; set; } = "";
    public string Date { get; set; } = "";
}
public sealed class EsrRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = "";
    public string Name { get; set; } = "";
    public string Shop { get; set; } = "";
    public string Phone { get; set; } = "";
    public string References { get; set; } = "";
    public string Condition { get; set; } = "";
    public string Jcn { get; set; } = "";
    public string WorkStatement { get; set; } = "";
    public string Refit { get; set; } = "";
    public string Component { get; set; } = "";
    public string Location { get; set; } = "";
    public string Site { get; set; } = "Bangor";
    public string RequestorId { get; set; } = "";
    public string Status { get; set; } = "Unassigned";
    public string? Serial { get; set; }
    public string? SerialBase { get; set; }
    public int Revision { get; set; }
    public string RevisionReason { get; set; } = "";
    public string? EngineerId { get; set; }
    public string Resolution { get; set; } = "";
    public string Rationale { get; set; } = "";
    public string Dfs { get; set; } = "";
    public string DfsReference { get; set; } = "";
    public string Tvd { get; set; } = "";
    public string TvdReference { get; set; } = "";
    public List<string> Attributes { get; set; } = [];
    public List<Attachment> Attachments { get; set; } = [];
    public List<Evidence> Comments { get; set; } = [];
    public List<Evidence> Signatures { get; set; } = [];
    public List<AuditEntry> Audit { get; set; } = [];
    public List<EsrRecord> Revisions { get; set; } = [];
    public Completion? Completion { get; set; }
    public string CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public string UpdatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("O");
    public int Version { get; set; } = 1;
    public bool Rejected { get; set; }
}
public sealed class Permission
{
    public string CrossSite { get; set; } = "none";
    public bool DualSign { get; set; }
    public string UpdatedBy { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}
public sealed class EngineeringTemplate
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Resolution { get; set; } = "";
    public string Rationale { get; set; } = "";
}
public sealed class LdsData
{
    public string WorkStatement { get; set; } = "";
    public string Refit { get; set; } = "";
    public string Component { get; set; } = "";
    public string Location { get; set; } = "";
}
public sealed class StoreData
{
    public List<EsrRecord> Records { get; set; } = [];
    public List<Actor> Users { get; set; } = [];
    public Dictionary<string, Permission> Permissions { get; set; } = [];
    public List<EngineeringTemplate> Templates { get; set; } = [];
    public Dictionary<string, LdsData> Lds { get; set; } = [];
    public int Sequence { get; set; } = 42;
}
public sealed class RuleException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}
