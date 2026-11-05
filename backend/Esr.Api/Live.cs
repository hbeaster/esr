using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
namespace Esr.Api;

/// <summary>What one open workspace is showing, reported by the client.</summary>
public sealed record Presence(string View, string? RecordId);

/// <summary>One open event stream. Its outbox drops the oldest frames if a slow client falls behind.</summary>
public sealed class LiveConnection(Actor actor)
{
    public string Id { get; } = Guid.NewGuid().ToString("N");
    public Actor Actor { get; } = actor;
    public Channel<string> Outbox { get; } = Channel.CreateBounded<string>(new BoundedChannelOptions(256) { FullMode = BoundedChannelFullMode.DropOldest });
    public Presence Presence { get; set; } = new("workspace", null);
}

/// <summary>
/// Process-local push hub for record changes and presence. Like the record
/// store, it lives in one process, which is why Kubernetes runs one replica.
/// </summary>
public sealed class LiveHub(Workflow workflow)
{
    static readonly string[] Views = ["workspace", "record", "watch-floor", "other"];
    readonly ConcurrentDictionary<string, LiveConnection> connections = new();
    public int Count => connections.Count;

    public LiveConnection Connect(Actor actor)
    {
        var connection = new LiveConnection(actor);
        connections[connection.Id] = connection;
        BroadcastPresence();
        return connection;
    }
    public void Disconnect(LiveConnection connection)
    {
        if (connections.TryRemove(connection.Id, out _)) BroadcastPresence();
    }
    /// <summary>The identity comes from the caller's JWT; a connection only reports for the identity that opened it.</summary>
    public void SetPresence(Actor actor, string connectionId, string view, string? recordId)
    {
        var connection = connections.GetValueOrDefault(connectionId) ?? throw new RuleException("Live connection not found.", 404);
        Workflow.Require(connection.Actor.Id == actor.Id, "This live connection belongs to another identity.", 403);
        Workflow.Require(Views.Contains(view), "Invalid view.");
        if (!string.IsNullOrEmpty(recordId)) lock (workflow.Sync) workflow.Find(actor, recordId);
        connection.Presence = new(view, string.IsNullOrEmpty(recordId) ? null : recordId);
        BroadcastPresence();
    }
    public static string Frame(string name, object data) => $"event: {name}\ndata: {JsonSerializer.Serialize(data, JsonConfig.Options)}\n\n";

    /// <summary>Call under <see cref="Workflow.Sync"/> right after a commit, so frames leave in commit order. Only identities that can see the record receive it.</summary>
    public void RecordChanged(EsrRecord record, string action, Actor actor, bool deleted = false)
    {
        var frame = Frame("record-changed", new { id = record.Id, version = record.Version, status = record.Status, serial = record.Serial, action, actor = actor.Name, actorId = actor.Id, deleted, time = DateTimeOffset.UtcNow.ToString("O") });
        foreach (var connection in connections.Values)
            if (workflow.Access(connection.Actor, record) != "none") connection.Outbox.Writer.TryWrite(frame);
    }

    /// <summary>Everyone sees who is online, but a record id is only shared with identities that can open that record.</summary>
    void BroadcastPresence()
    {
        var snapshot = connections.Values.ToArray();
        lock (workflow.Sync)
            foreach (var to in snapshot)
            {
                var visible = workflow.Visible(to.Actor).Select(r => r.Id).ToHashSet();
                var viewers = snapshot.Select(c => new
                {
                    connectionId = c.Id,
                    userId = c.Actor.Id,
                    name = c.Actor.Name,
                    role = c.Actor.Role,
                    site = c.Actor.Site,
                    view = c.Presence.View,
                    recordId = c.Presence.RecordId is { } id && visible.Contains(id) ? id : null,
                });
                to.Outbox.Writer.TryWrite(Frame("presence", new { viewers }));
            }
    }
}
