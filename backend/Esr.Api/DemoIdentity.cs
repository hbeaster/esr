using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
namespace Esr.Api;

/// <summary>Ephemeral HS256 demo JWTs. The public identity selector is intentionally not production authentication.</summary>
public sealed class DemoIdentity
{
    readonly byte[] secret = RandomNumberGenerator.GetBytes(32);
    static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    static byte[] Decode(string value) { var s = value.Replace('-', '+').Replace('_', '/'); return Convert.FromBase64String(s.PadRight((s.Length + 3) / 4 * 4, '=')); }
    string Mac(string input) => Encode(HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(input)));
    public string Issue(Actor user)
    {
        var header = Encode(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"));
        var payload = Encode(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new { sub = user.Id, name = user.Name, exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds(), iss = "esr-demo", aud = "esr-workspace" }));
        return $"{header}.{payload}.{Mac($"{header}.{payload}")}";
    }
    public Actor Validate(string token, IEnumerable<Actor> users)
    {
        try
        {
            var pieces = token.Split('.'); if (pieces.Length != 3) throw new FormatException();
            var input = $"{pieces[0]}.{pieces[1]}";
            if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(pieces[2]), Encoding.ASCII.GetBytes(Mac(input)))) throw new FormatException();
            var header = JsonNode.Parse(Decode(pieces[0]))!; var p = JsonNode.Parse(Decode(pieces[1]))!;
            if (header["alg"]?.GetValue<string>() != "HS256" || p["iss"]?.GetValue<string>() != "esr-demo" || p["aud"]?.GetValue<string>() != "esr-workspace" || p["exp"]!.GetValue<long>() <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()) throw new FormatException();
            return users.First(u => u.Id == p["sub"]!.GetValue<string>() && u.Name == p["name"]!.GetValue<string>());
        }
        catch { throw new RuleException("Demo session expired or invalid. Select an identity again.", 401); }
    }
}
