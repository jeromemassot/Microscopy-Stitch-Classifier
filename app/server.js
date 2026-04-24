const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the tiles directory
const tilesDir = path.join(__dirname, '../tiles');
app.use('/tiles', express.static(tilesDir));

// Recursive function to get all files in a directory
async function getFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

// API endpoint to get all tile images
app.get('/api/tiles', async (req, res) => {
    try {
        const allFiles = await getFiles(tilesDir);
        console.log(`Found ${allFiles.length} total files in tiles directory`);
        
        let categoryMap = {};
        try {
            const csvContent = await fs.readFile(path.join(__dirname, '../datasets/full.csv'), 'utf-8');
            const lines = csvContent.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(',');
                const imgPath = parts[0];
                const category = parts[parts.length - 1].replace('\r', '');
                const normalizedPath = imgPath.replace('../tiles/', '').replace(/\\/g, '/');
                categoryMap[normalizedPath] = category;
            }
        } catch (csvError) {
            console.error("Error reading full.csv:", csvError);
        }

        const imageExtensions = ['.png', '.jpg', '.jpeg', '.tif', '.tiff'];
        
        const images = allFiles
            .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
            .map(file => {
                const relativePath = path.relative(tilesDir, file);
                const posixPath = relativePath.split(path.sep).join('/');
                const parts = relativePath.split(path.sep);
                
                return {
                    url: `/tiles/${posixPath}`,
                    filename: path.basename(file),
                    directory: path.dirname(relativePath).split(path.sep).join('/'),
                    parts: parts,
                    category: categoryMap[posixPath] || 'Unknown'
                };
            });
            
        console.log(`Filtered down to ${images.length} image files`);
        res.json(images);
    } catch (error) {
        console.error("Error reading tiles directory:", error);
        res.status(500).json({ error: "Failed to read tiles directory" });
    }
});

const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is already in use. Trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
};

startServer(PORT);
