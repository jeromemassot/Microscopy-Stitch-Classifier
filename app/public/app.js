document.addEventListener('DOMContentLoaded', () => {
    const tabContainer = document.getElementById('tab-container');
    const searchInput = document.getElementById('search-input');
    const filterContainer = document.getElementById('filter-container');
    const countDisplay = document.getElementById('image-count');
    
    // Lightbox elements
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxInfo = document.getElementById('lightbox-info');
    const closeBtn = document.getElementById('close-lightbox');

    let allImages = [];
    let filteredImages = [];
    let activeFilters = {};

    // Fetch images from API
    fetch('/api/tiles')
        .then(res => res.json())
        .then(data => {
            allImages = data;
            filteredImages = data;
            
            // Build dynamic filters
            buildFilters(data);
            
            renderGrid(filteredImages);
        })
        .catch(err => {
            console.error("Failed to load images:", err);
            tabContainer.innerHTML = `<div class="loading" style="color: red;">Error loading images. Ensure server is running properly.</div>`;
        });

    function buildFilters(data) {
        // Find all unique values at specific levels
        const level4 = new Set(); // e.g. Z1, exaSPIM
        const level5 = new Set(); // e.g. good, bad
        const categories = new Set(); // train, validation, test

        data.forEach(img => {
            if(img.parts.length > 2) level4.add(img.parts[2]);
            if(img.parts.length > 3) level5.add(img.parts[3]);
            if(img.category && img.category !== 'Unknown') categories.add(img.category);
        });

        const filterHTML = [];

        // Helper to generate checkboxes
        const genCheckbox = (category, values) => {
            if(values.size === 0) return '';
            let html = `<div class="filter-group"><h4>${category}</h4>`;
            activeFilters[category] = new Set();
            
            values.forEach(val => {
                if(val && val.length < 20 && !val.includes('HCR') && val !== 'microscopy' && val !== 'SPIM') {
                    html += `
                        <label class="filter-label">
                            <input type="checkbox" value="${val}" data-category="${category}">
                            ${val}
                        </label>
                    `;
                }
            });
            html += `</div>`;
            return html;
        };

        filterHTML.push(genCheckbox('Instrument', level4));
        filterHTML.push(genCheckbox('Label', level5));
        filterHTML.push(genCheckbox('Dataset', categories));

        filterContainer.innerHTML = filterHTML.join('');

        // Add event listeners to new checkboxes
        document.querySelectorAll('.filter-label input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                const value = e.target.value;
                
                if(e.target.checked) {
                    activeFilters[category].add(value);
                } else {
                    activeFilters[category].delete(value);
                }
                applyFilters();
            });
        });
    }

    function applyFilters() {
        const query = searchInput.value.toLowerCase();
        
        filteredImages = allImages.filter(img => {
            // Text search
            const matchesSearch = img.filename.toLowerCase().includes(query) || 
                                  img.directory.toLowerCase().includes(query);
            
            if(!matchesSearch) return false;

            // Checkbox filters
            let matchesCategories = true;
            for(const [category, activeValues] of Object.entries(activeFilters)) {
                if(activeValues.size > 0) {
                    if (category === 'Dataset') {
                        if (!activeValues.has(img.category)) {
                            matchesCategories = false;
                            break;
                        }
                    } else {
                        // Check if the image path contains ANY of the active values for this category
                        const hasValue = Array.from(activeValues).some(val => img.directory.includes(val));
                        if(!hasValue) {
                            matchesCategories = false;
                            break;
                        }
                    }
                }
            }

            return matchesCategories;
        });

        renderGrid(filteredImages);
    }

    searchInput.addEventListener('input', applyFilters);

    function renderGrid(images) {
        countDisplay.textContent = images.length;
        
        if(images.length === 0) {
            tabContainer.innerHTML = `<div class="loading">No images match your filters.</div>`;
            return;
        }

        // Determine active dataset categories
        let selectedCategories = [];
        if (activeFilters['Dataset'] && activeFilters['Dataset'].size > 0) {
            selectedCategories = Array.from(activeFilters['Dataset']);
        }

        if (selectedCategories.length <= 1) {
            // Single grid layout
            tabContainer.innerHTML = `
                <div class="tab-column" style="border: none; background: transparent;">
                    <div class="image-grid" id="grid-main"></div>
                </div>
            `;
            const mainGrid = document.getElementById('grid-main');
            mainGrid.innerHTML = generateCardsHTML(images);
            attachCardListeners(mainGrid);
        } else {
            // Side-by-side tabs layout
            let tabsHTML = '';
            selectedCategories.forEach(cat => {
                tabsHTML += `
                    <div class="tab-column">
                        <div class="tab-header">${cat}</div>
                        <div class="image-grid" id="grid-${cat}"></div>
                    </div>
                `;
            });
            tabContainer.innerHTML = tabsHTML;

            selectedCategories.forEach(cat => {
                const catImages = images.filter(img => img.category === cat);
                const grid = document.getElementById(`grid-${cat}`);
                grid.innerHTML = generateCardsHTML(catImages);
                attachCardListeners(grid);
            });
        }
    }

    function generateCardsHTML(images) {
        if(images.length === 0) return `<div class="loading" style="grid-column: 1/-1;">No images in this category.</div>`;
        const toRender = images.slice(0, 200);

        return toRender.map(img => {
            const isGood = img.directory.includes('/good');
            const isBad = img.directory.includes('/bad');
            
            let tagHTML = '';
            if(isGood) tagHTML += `<span class="tag good">Good</span>`;
            if(isBad) tagHTML += `<span class="tag bad">Bad</span>`;
            if(img.category && img.category !== 'Unknown') tagHTML += `<span class="tag">${img.category}</span>`;

            const instruments = ['Z1', 'exaSPIM', 'smartSPIM'];
            instruments.forEach(inst => {
                if(img.directory.includes(inst)) {
                    tagHTML += `<span class="tag">${inst}</span>`;
                }
            });

            return `
                <div class="image-card" data-url="${img.url}" data-dir="${img.directory}" data-name="${img.filename}">
                    <div class="tag-container">${tagHTML}</div>
                    <div class="action-buttons" style="position: absolute; top: 10px; right: 10px; z-index: 3;">
                        <button class="view-btn" style="background: rgba(0,0,0,0.6); color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px;" title="View Fullscreen">👁️ View</button>
                    </div>
                    <div class="img-container">
                        <img src="${img.url}" loading="lazy" alt="${img.filename}">
                    </div>
                    <div class="image-info">
                        <div class="image-name" title="${img.filename}">${img.filename}</div>
                        <div class="image-path" title="${img.directory}">${img.directory}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function attachCardListeners(container) {
        container.querySelectorAll('.image-card').forEach(card => {
            // View Fullscreen Button
            const viewBtn = card.querySelector('.view-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent card click
                    const url = card.dataset.url;
                    const dir = card.dataset.dir;
                    const name = card.dataset.name;
                    
                    lightboxImg.src = url;
                    lightboxInfo.innerHTML = `<strong>${name}</strong><br><span style="color:#94a3b8">${dir}</span>`;
                    lightbox.classList.add('active');
                });
            }

            // Click on card to find matches
            card.addEventListener('click', () => {
                const name = card.dataset.name;
                const isAlreadySelected = card.classList.contains('selected-source');
                
                // Reset all cards globally
                document.querySelectorAll('.image-card').forEach(c => {
                    c.classList.remove('selected-source', 'highlight-match', 'dimmed');
                });

                if (!isAlreadySelected) {
                    // Highlight mode
                    document.querySelectorAll('.image-card').forEach(c => {
                        if (c.dataset.name === name) {
                            c.classList.add(c === card ? 'selected-source' : 'highlight-match');
                            // Scroll into view if it's in another container (a match)
                            if (c !== card) {
                                c.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        } else {
                            c.classList.add('dimmed');
                        }
                    });
                }
            });
        });
    }

    // Lightbox close logic
    closeBtn.addEventListener('click', () => {
        lightbox.classList.remove('active');
    });

    lightbox.addEventListener('click', (e) => {
        if(e.target === lightbox) {
            lightbox.classList.remove('active');
        }
    });
});
