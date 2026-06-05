/**
 * GitHub API Helper Module
 * Interacts with the GitHub REST API to pull and push the encrypted database.
 */

class GitHubClient {
    constructor(username, repo, token, path = "vault_v4.enc") {
        this.username = username;
        this.repo = repo;
        this.token = token;
        this.path = path;
        this.baseUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;
    }

    /**
     * Standard fetch headers
     */
    getHeaders() {
        return {
            "Authorization": `token ${this.token}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };
    }

    /**
     * Fetches the file from GitHub.
     * Returns { content: string, sha: string } or null if file does not exist (404).
     */
    async fetchFile() {
        try {
            const response = await fetch(this.baseUrl, {
                method: "GET",
                headers: this.getHeaders(),
                cache: "no-store" // Prevent caching
            });

            if (response.status === 404) {
                return null; // File doesn't exist yet
            }

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            
            // GitHub returns base64 content with newlines, clean it
            const cleanedBase64 = data.content.replace(/\s/g, '');
            // Decode base64 to UTF-8 string
            const decodedContent = decodeURIComponent(escape(atob(cleanedBase64)));

            return {
                content: decodedContent,
                sha: data.sha
            };
        } catch (error) {
            console.error("GitHub fetch error:", error);
            throw error;
        }
    }

    /**
     * Saves (commits) the file to GitHub.
     * @param {string} content - Plain string content (usually stringified encrypted JSON)
     * @param {string} sha - The current SHA of the file (required for updates, null for creation)
     * @returns {Promise<string>} - The new SHA of the committed file
     */
    async saveFile(content, sha = null) {
        try {
            // Encode content to base64 safely supporting unicode
            const base64Content = btoa(unescape(encodeURIComponent(content)));

            const body = {
                message: `Sincronización Gestor Contraseñas V4.0 - ${new Date().toISOString()}`,
                content: base64Content
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(this.baseUrl, {
                method: "PUT",
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 409) {
                    throw new Error("Conflict: El archivo en GitHub ha sido modificado por otro dispositivo. Por favor, recarga y sincroniza antes de guardar.");
                }
                throw new Error(errData.message || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            return data.content.sha; // Return the new SHA
        } catch (error) {
            console.error("GitHub save error:", error);
            throw error;
        }
    }
}
