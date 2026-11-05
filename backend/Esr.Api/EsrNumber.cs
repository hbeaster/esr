namespace Esr.Api;

/// <summary>
/// An ESR number is a two-digit year, a sequence from 0001 to 9999, and a revision from A to ZZ.
/// 260001ZZ is year 26, sequence 0001, revision ZZ.
/// </summary>
public static class EsrNumber
{
    public static string Base(int year, int sequence)
    {
        Workflow.Require(sequence is >= 1 and <= 9999, "Annual serial limit reached.");
        return $"{year % 100:D2}{sequence:D4}";
    }

    public static string Format(string serialBase, int revision) => serialBase + Workflow.RevisionSuffix(revision);
}
