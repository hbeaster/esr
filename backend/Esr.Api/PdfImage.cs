using System.Buffers.Binary;
using System.IO.Compression;
namespace Esr.Api;

/// <summary>Portable PDF image conversion for JPEG and non-interlaced 8-bit PNG continuation sheets.</summary>
internal sealed record PdfImage(int Width, int Height, byte[] Bytes, string Filter, string ColorSpace)
{
    public static PdfImage? Read(Attachment attachment)
    {
        try
        {
            var bytes = Convert.FromBase64String(attachment.Base64);
            if (attachment.Type == "image/jpeg") return Jpeg(bytes);
            if (attachment.Type == "image/png") return Png(bytes);
        }
        catch (Exception e) when (e is IOException or ArgumentException or IndexOutOfRangeException or OverflowException) { /* Original remains embedded even when a preview cannot be decoded. */ }
        return null;
    }
    static PdfImage? Jpeg(byte[] bytes)
    {
        if (bytes.Length < 4 || bytes[0] != 255 || bytes[1] != 216) return null;
        var i = 2;
        while (i + 8 < bytes.Length)
        {
            if (bytes[i++] != 255) continue;
            var marker = bytes[i++]; if (marker is 0xD8 or 0xD9 || marker == 0xFF) continue;
            var length = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(i, 2)); if (length < 2 || i + length > bytes.Length) return null;
            if (marker is 0xC0 or 0xC1 or 0xC2)
            {
                var height = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(i + 3, 2)); var width = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(i + 5, 2)); var channels = bytes[i + 7];
                if (width == 0 || height == 0 || channels is not (1 or 3)) return null;
                return new(width, height, bytes, "/DCTDecode", channels == 1 ? "/DeviceGray" : "/DeviceRGB");
            }
            i += length;
        }
        return null;
    }
    static PdfImage? Png(byte[] bytes)
    {
        if (bytes.Length < 33 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return null;
        var width = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16, 4)); var height = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20, 4));
        if (width <= 0 || height <= 0 || (long)width * height > 24_000_000 || bytes[24] != 8 || bytes[28] != 0) return null;
        var color = bytes[25]; var channels = color switch { 0 => 1, 2 => 3, 3 => 1, 4 => 2, 6 => 4, _ => 0 }; if (channels == 0) return null;
        using var compressed = new MemoryStream(); byte[]? palette = null; byte[]? transparency = null;
        for (var offset = 8; offset + 12 <= bytes.Length;)
        {
            var length = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(offset, 4)); if (length < 0 || (long)offset + length + 12 > bytes.Length) return null;
            var type = System.Text.Encoding.ASCII.GetString(bytes, offset + 4, 4);
            if (type == "IDAT") compressed.Write(bytes, offset + 8, length);
            else if (type == "PLTE") palette = bytes.AsSpan(offset + 8, length).ToArray();
            else if (type == "tRNS") transparency = bytes.AsSpan(offset + 8, length).ToArray();
            offset += length + 12;
        }
        if (color == 3 && palette is null) return null;
        compressed.Position = 0; using var inflater = new ZLibStream(compressed, CompressionMode.Decompress);
        var stride = checked(width * channels); var previous = new byte[stride]; var row = new byte[stride]; var rgb = new byte[checked(width * height * 3)];
        for (var y = 0; y < height; y++)
        {
            var filter = inflater.ReadByte(); if (filter is < 0 or > 4) return null; inflater.ReadExactly(row);
            for (var x = 0; x < stride; x++)
            {
                var left = x >= channels ? row[x - channels] : 0; var above = previous[x]; var upperLeft = x >= channels ? previous[x - channels] : 0;
                row[x] = unchecked((byte)(row[x] + (filter switch { 1 => left, 2 => above, 3 => (left + above) / 2, 4 => Paeth(left, above, upperLeft), _ => 0 })));
            }
            for (var x = 0; x < width; x++)
            {
                var source = x * channels; var target = (y * width + x) * 3; var alpha = color == 6 ? row[source + 3] : color == 4 ? row[source + 1] : color == 3 && transparency is not null && row[source] < transparency.Length ? transparency[row[source]] : 255;
                for (var c = 0; c < 3; c++)
                {
                    var component = color == 3 ? palette![row[source] * 3 + c] : color is 0 or 4 ? row[source] : row[source + c];
                    rgb[target + c] = (byte)((component * alpha + 255 * (255 - alpha)) / 255);
                }
            }
            (row, previous) = (previous, row);
        }
        using var output = new MemoryStream(); using (var deflater = new ZLibStream(output, CompressionLevel.Optimal, true)) deflater.Write(rgb);
        return new(width, height, output.ToArray(), "/FlateDecode", "/DeviceRGB");
    }
    static int Paeth(int a, int b, int c) { var p = a + b - c; var pa = Math.Abs(p - a); var pb = Math.Abs(p - b); var pc = Math.Abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
}
