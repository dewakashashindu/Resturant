using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;

// This tool is compiled and run ONCE during installation (by the Inno Setup
// script), and is deleted immediately afterward. It reads plaintext lines
// from an input file and writes AES-256 encrypted (Base64) lines, in the
// same order, to an output file. The key/IV derivation here MUST stay
// identical to Decrypt() in template.cs, or decryption at runtime will fail.
class Encryptor
{
    static int Main(string[] args)
    {
        try
        {
            if (args.Length < 2)
            {
                Console.Error.WriteLine("Usage: Encryptor.exe <inputFile> <outputFile>");
                return 1;
            }

            string inputFile = args[0];
            string outputFile = args[1];

            var key = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes("MicroEChefSecretKey2026"));
            var iv = new byte[16];
            Array.Copy(key, iv, 16);

            string[] lines = File.ReadAllLines(inputFile, Encoding.UTF8);
            var sb = new StringBuilder();

            foreach (var line in lines)
            {
                using (Aes aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;
                    using (var encryptor = aes.CreateEncryptor(aes.Key, aes.IV))
                    {
                        byte[] plainBytes = Encoding.UTF8.GetBytes(line);
                        byte[] cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
                        sb.AppendLine(Convert.ToBase64String(cipherBytes));
                    }
                }
            }

            File.WriteAllText(outputFile, sb.ToString(), Encoding.UTF8);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Encryptor failed: " + ex.Message);
            return 1;
        }
    }
}