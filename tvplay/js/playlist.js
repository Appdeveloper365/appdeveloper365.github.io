/**
 * playlist.js
 * M3U/M3U8 playlist parser for TVPlay
 */

class PlaylistParser {
  /**
   * Parse an M3U/M3U8 string into an array of channel objects.
   * @param {string} content - Raw playlist text
   * @returns {Array<{name, url, logo, group, id}>}
   */
  static parse(content) {
    const lines = content.split(/\r?\n/);
    const channels = [];
    let current = null;

    // Must start with #EXTM3U (but be lenient)
    const hasExtm3u = lines.some(l => l.trim().startsWith('#EXTM3U'));
    if (!hasExtm3u && lines.length > 0) {
      // Not an M3U file, try to treat each line as a URL
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          channels.push({
            name: `Channel ${idx + 1}`,
            url: trimmed,
            logo: '',
            group: 'Unknown',
            id: `custom-${idx}`
          });
        }
      });
      return channels;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        current = this.parseExtinf(line);
      } else if (line && !line.startsWith('#') && current) {
        // Next non-comment line is the URL
        current.url = line;
        if (!current.id) current.id = this.makeId(current.name || 'channel');
        if (!current.group) current.group = 'General';
        channels.push(current);
        current = null;
      }
    }

    return channels;
  }

  static parseExtinf(line) {
    // Remove #EXTINF: and optional duration
    const match = line.match(/#EXTINF:(-?\d*\.?\d*),(.*)/);
    const attributes = match ? match[2] : line;

    // Extract tvg-logo
    const logoMatch = attributes.match(/tvg-logo="([^"]*)"/);
    const logo = logoMatch ? logoMatch[1] : '';

    // Extract group-title
    const groupMatch = attributes.match(/group-title="([^"]*)"/);
    const group = groupMatch ? groupMatch[1] : 'General';

    // Extract tvg-name or tvg-id
    const nameMatch = attributes.match(/tvg-name="([^"]*)"/);
    const idMatch = attributes.match(/tvg-id="([^"]*)"/);

    // Channel name is after the last comma
    const commaIdx = attributes.lastIndexOf(',');
    const displayName = commaIdx !== -1 ? attributes.substring(commaIdx + 1).trim() : 'Unknown Channel';

    return {
      name: displayName,
      url: '',
      logo: logo,
      group: group,
      id: (idMatch && idMatch[1]) || (nameMatch && nameMatch[1]) || '',
      raw: attributes
    };
  }

  static makeId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /**
   * Fetch a playlist URL and parse it.
   * @param {string} url - Playlist URL
   * @returns {Promise<Array>}
   */
  static async fetch(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return PlaylistParser.parse(text);
    } catch (err) {
      console.error(`Failed to load playlist ${url}:`, err);
      return [];
    }
  }
}

window.PlaylistParser = PlaylistParser;