const express = require('express');
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT 

// Middleware to serve static files and parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to render the HTML form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to fetch HTML from a website
const getHTML = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching HTML:', error.message);
        throw error;
    }
};

// Function to scrape and convert HTML data to JSON
const convert = (htmlString) => {
    const dom = new JSDOM(htmlString);
    const { document } = dom.window;
    const elements = document.querySelectorAll('.card-wrapper.product-card-wrapper');

    const products = [];
    elements.forEach((card) => {
        const formatPrice = (priceString) => {
            const numericPrice = priceString.replace(/[^\d.]/g, '');
            return numericPrice || 'N/A';
        };

        const formatImageUrl = (url) => {
            if (url.startsWith('//')) {
                return `https:${url}`;
            }
            return url;
        };

        const product = {
            name: card.querySelector('.card__heading a')?.textContent.trim() || 'N/A',
            vendor: card.querySelector('.product__vendor')?.textContent.trim() || 'N/A',
            price: formatPrice(card.querySelector('.price-item--sale')?.textContent.trim() || card.querySelector('.price-item--regular')?.textContent.trim() || 'N/A'),
            originalPrice: formatPrice(card.querySelector('.price-item--regular')?.textContent.trim() || 'N/A'),
            discount: card.querySelector('.badge')?.textContent.trim() || 'N/A',
            image: formatImageUrl(card.querySelector('img')?.getAttribute('src') || 'N/A'),
            link: card.querySelector('.card__heading a')?.getAttribute('href') || 'N/A'
        };
        products.push(product);
    });
    return products;
};

// Function to create a CSV file
const createExcel = (productData) => {
    const csv = Papa.unparse(productData);
    const filePath = path.join(__dirname, 'products.csv');
    fs.writeFileSync(filePath, csv);
    return filePath;
};

// Endpoint to handle form submission and scrape data
app.post('/scrape', async (req, res) => {
    try {
        const { urls } = req.body; // URLs from the form
        const urlList = Array.isArray(urls) ? urls : [urls]; // Ensure it's an array

        const allProductData = [];
        for (const url of urlList) {
            const html = await getHTML(url);
            const productData = convert(html);
            allProductData.push(...productData);
        }

        const csvFilePath = createExcel(allProductData);
        res.download(csvFilePath, 'products.csv', (err) => {
            if (err) {
                console.error('Error sending the file:', err.message);
                res.status(500).send('Error downloading the file');
            }
            fs.unlinkSync(csvFilePath); // Clean up after sending the file
        });
    } catch (error) {
        console.error('Error processing request:', error.message);
        res.status(500).send('An error occurred while processing your request.');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
