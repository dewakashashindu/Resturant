using System;
using System.Text;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Collections.Generic;

public class Startup
{
    // 🔒 Real AES-256 decryption. The installer's Encryptor.cs uses the exact
    // same key derivation + IV, so values encrypted at install time decrypt
    // correctly here at runtime.
    private static string Decrypt(string cipherText)
    {
        try
        {
            if (string.IsNullOrEmpty(cipherText) || cipherText.StartsWith("#")) return "";

            byte[] cipherBytes = Convert.FromBase64String(cipherText);
            using (Aes aes = Aes.Create())
            {
                var key = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes("MicroEChefSecretKey2026"));
                var iv = new byte[16];
                Array.Copy(key, iv, 16);

                aes.Key = key;
                aes.IV = iv;
                using (var decryptor = aes.CreateDecryptor(aes.Key, aes.IV))
                {
                    byte[] decryptedBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
                    return Encoding.UTF8.GetString(decryptedBytes);
                }
            }
        }
        catch
        {
            return "";
        }
    }

    public async Task<object> LoadConfig(object input)
    {
        var config = new Dictionary<string, string>();

        config.Add("DB_SERVER", Decrypt("#DB_SERVER#"));
        config.Add("DB_USER", Decrypt("#DB_USER#"));
        config.Add("DB_PASS", Decrypt("#DB_PASS#"));
        config.Add("DB_NAME", Decrypt("#DB_NAME#"));

        config.Add("REMARKS_DB_SERVER", Decrypt("#REMARKS_DB_SERVER#"));
        config.Add("REMARKS_DB_USER", Decrypt("#REMARKS_DB_USER#"));
        config.Add("REMARKS_DB_PASS", Decrypt("#REMARKS_DB_PASS#"));
        config.Add("REMARKS_DB_NAME", Decrypt("#REMARKS_DB_NAME#"));

        config.Add("JWT_SECRET", Decrypt("#JWT_SECRET#"));
        config.Add("PORT", Decrypt("#PORT#"));

        return config;
    }
}