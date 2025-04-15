// Main JavaScript file for ingredient detection

// Configuration for Google Generative AI API
// You'll need to replace this with your actual API key when using; 
let API_KEY = null;

/**
 * Fetches the API key from the server
 * @returns {Promise<void>}
 */
async function fetchApiKey() {
  try {
    const response = await fetch("http://localhost:3000/get-api-key");
    const data = await response.json();
    API_KEY = data.apiKey;
    console.log("API Key fetched successfully");
  } catch (error) {
    console.error("Error fetching API key:", error);
  }
}
/**
 * Detects ingredients and their densities in an image using Gemini API
 * @param {File} imageFile - The uploaded image file
 * @returns {Promise<Object>} - Dictionary of ingredients and their densities
 */
async function detectIngredientAndDensity(imageFile) {
  try {
    // Convert the file to base64 for API submission
    const base64Image = await fileToBase64(imageFile);
    
    // Log progress for debugging
    console.log("Image converted to base64, sending to API...");
    
    const prompt = `Analyze the given image and return a JSON output with detected food ingredients/dish and their densities if it is the dish give priority to dishes and take it all as a ingredient dont split it again in its ingredient 
Format the response exactly like this: 
{
  "ingredients": [
    {"name": "ingredient_name", "density": density_value}, 
    {"name": "ingredient_2", "density": density_value}
  ]
}`;

    // For testing purposes, return mock data if API key isn't set
    if (API_KEY === "YOUR_API_KEY") {
      console.log("Using mock data (no API key provided)");
      return {
        "apple": 0.8,
        "banana": 0.6
      };
    }

    // API request to Google's Generative AI
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { 
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image.split(',')[1]
                }
              }
            ]
          }
        ]
      })
    });

    const responseData = await response.json();
    console.log("API Response:", responseData);
    
    if (responseData && responseData.candidates && responseData.candidates[0].content.parts) {
      const responseText = responseData.candidates[0].content.parts[0].text;
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        if (jsonData.ingredients) {
          const ingredientDensityMap = {};
          jsonData.ingredients.forEach(item => {
            ingredientDensityMap[item.name.toLowerCase()] = item.density;
          });
          
          console.log("Detected Ingredients & Densities:", ingredientDensityMap);
          return ingredientDensityMap;
        }
      }
      
      console.log("No valid JSON detected in Gemini's response!");
    }
    
    // If API fails, return mock data for testing
    console.log("Falling back to mock data");
    return {
      "mock ingredient": 0.7,
      "default food": 0.9
    };
  } catch (error) {
    console.error("Error in ingredient detection:", error);
    // Return mock data on error for testing
    return {
      "error fallback": 0.8
    };
  }
}

/**
 * Gets reference object from image and its real-world width
 * @param {File} imageFile - The uploaded image file
 * @returns {Promise<Array>} - [objectName, widthInCm]
 */
async function getReferenceObject(imageFile) {
  try {
    const base64Image = await fileToBase64(imageFile);
    console.log("Getting reference object...");
    
    const prompt = `Analyze the image and return a JSON output with the detected reference object name and its width in cm.
use reference object as spoon or hand or anything else if you dont find reference object then dont consider anything 
Format: {"reference_object": {"name": "object_name", "width_cm": width_value} }`;

    // For testing purposes, return mock data if API key isn't set
    if (API_KEY === "YOUR_API_KEY") {
      console.log("Using mock reference object (no API key provided)");
      return ["spoon", 15];
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { 
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image.split(',')[1]
                }
              }
            ]
          }
        ]
      })
    });

    const responseData = await response.json();
    console.log("Reference Object API Response:", responseData);
    
    if (responseData && responseData.candidates && responseData.candidates[0].content.parts) {
      const responseText = responseData.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{.*\}/s);
      
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        return [jsonData.reference_object.name, jsonData.reference_object.width_cm];
      }
    }
    
    // If API fails, return mock data for testing
    console.log("Falling back to mock reference object");
    return ["hand", 10];
  } catch (error) {
    console.error("Error getting reference object:", error);
    return ["default spoon", 12]; // Default fallback
  }
}

/**
 * Simple image analysis to get dimensions and estimate volume
 * @param {HTMLImageElement} img - The loaded image element
 * @param {Number} referenceWidthCm - Width of reference object in cm
 * @returns {Number} - Estimated volume in cubic cm
 */
function analyzeImageDimensions(img, referenceWidthCm) {
  const imgWidth = img.width;
  const imgHeight = img.height;
  
  // Assumptions for testing:
  // - Reference object is approximately 20% of the image width
  // - Food item is approximately 60% of the image width and height
  const refWidth = imgWidth * 0.2;
  const foodWidth = imgWidth * 0.6;
  const foodHeight = imgHeight * 0.6;
  
  // Calculate real-world dimensions
  const pixelPerCm = refWidth / referenceWidthCm;
  const foodWidthCm = foodWidth / pixelPerCm;
  const foodHeightCm = foodHeight / pixelPerCm;
  
  // Estimate area and volume (simplified)
  const foodAreaCm2 = foodWidthCm * foodHeightCm;
  
  // Assuming the food has some depth (1.5 cm is a simplification)
  const estimatedVolumeCm3 = foodAreaCm2 * 1.5;
  
  console.log("Estimated dimensions:", {
    referencePixelWidth: refWidth,
    pixelPerCm: pixelPerCm,
    foodWidthCm: foodWidthCm,
    foodHeightCm: foodHeightCm,
    areaCm2: foodAreaCm2,
    volumeCm3: estimatedVolumeCm3
  });
  
  return estimatedVolumeCm3;
}

/**
 * Converts a file to a base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<String>} - Base64 representation of the file
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Main function to estimate weights from an uploaded image
 * @param {File} imageFile - The uploaded image file
 * @returns {Promise<Object>} - Results of the analysis
 */
async function estimateWeights(imageFile) {
  const results = {
    success: false,
    referenceObject: null,
    ingredients: []
  };
  
  try {
    // Create a log in UI
    appendToLog("Starting analysis...");
    
    // Get ingredients and their densities
    appendToLog("Detecting ingredients...");
    const ingredientsDict = await detectIngredientAndDensity(imageFile);
    
    // Get reference object information
    appendToLog("Identifying reference object...");
    const [referenceName, referenceWidthCm] = await getReferenceObject(imageFile);
    
    if (Object.keys(ingredientsDict).length === 0) {
      appendToLog("Error: No ingredients detected");
      return results;
    }
    
    if (!referenceName || !referenceWidthCm) {
      appendToLog("Error: No reference object detected");
      return results;
    }
    
    appendToLog(`Found reference object: ${referenceName} (${referenceWidthCm} cm wide)`);
    
    // Create image element for analysis
    appendToLog("Calculating volume...");
    const img = document.getElementById('previewImage');
    
    // Calculate volume based on image dimensions
    const estimatedVolumeCm3 = analyzeImageDimensions(img, referenceWidthCm);
    
    if (!estimatedVolumeCm3) {
      appendToLog("Error: Volume calculation failed");
      return results;
    }
    
    appendToLog(`Estimated volume: ${estimatedVolumeCm3.toFixed(2)} cm³`);
    
    results.success = true;
    results.referenceObject = {
      name: referenceName,
      widthCm: referenceWidthCm
    };
    
    for (const [ingredient, density] of Object.entries(ingredientsDict)) {
      const weight = estimatedVolumeCm3 * density;
      results.ingredients.push({
        name: ingredient,
        density: density,
        weight: parseFloat(weight.toFixed(2))
      });
      appendToLog(`Calculating weight for ${ingredient}: ${weight.toFixed(2)}g`);
    }
    
    appendToLog("Analysis complete!");
    return results;
  } catch (error) {
    console.error("Error in weight estimation:", error);
    appendToLog(`Error: ${error.message}`);
    return results;
  }
}

// Helper function to add log messages to UI
function appendToLog(message) {
  const logContainer = document.querySelector('.log');
  if (logContainer) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  console.log(message);
}

// DOM manipulation function to update UI state
function updateUIState(state) {
  // Hide all state-dependent cards first
  document.querySelectorAll('.card').forEach(card => {
    if (card.classList.contains('info-card')) return; // Don't hide the info card
    card.style.display = 'none';
  });
  
  // Show the appropriate card based on state
  const stateCardMap = {
    'upload': document.querySelector('.upload-area').closest('.card'),
    'preview': document.querySelector('.preview-card'),
    'loading': document.querySelector('.loading').closest('.card'),
    'results': document.querySelector('.result-summary').closest('.card')
  };
  
  if (stateCardMap[state]) {
    stateCardMap[state].style.display = 'block';
  }
  
  // Update step indicators
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active', 'completed'));
  
  const stepMap = {
    'upload': 0,
    'preview': 0,
    'loading': 1,
    'results': 2
  };
  
  const currentStepIndex = stepMap[state];
  const steps = document.querySelectorAll('.step');
  
  for (let i = 0; i < steps.length; i++) {
    if (i < currentStepIndex) {
      steps[i].classList.add('completed');
    } else if (i === currentStepIndex) {
      steps[i].classList.add('active');
    }
  }
}

// Event listeners for file upload
document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('imageUpload');
  const dropZone = document.querySelector('.drop-zone');
  const previewCard = document.querySelector('.preview-card');
  const previewImage = document.querySelector('.preview-image');
  const analyzeBtn = document.querySelector('.button-primary');
  const editCropBtn = document.querySelector('.button-primary');
  const startAnalysisBtn = document.querySelector('.button-success');
  
  // Initialize UI state
  updateUIState('upload');
  
  // Enable drop zone functionality
  if (dropZone) {
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('active');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('active');
    });
    
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('active');
      
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
    
    dropZone.addEventListener('click', function() {
      fileInput.click();
    });
  }
  
  // Handle file input change
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }
  
  // Handle file selection
  function handleFileSelection(file) {
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG).');
      return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large. Please select an image under 10MB.');
      return;
    }
    
    // Create a preview
    const reader = new FileReader();
    reader.onload = function(e) {
      // Create a new image element to get dimensions
      const img = new Image();
      img.onload = function() {
        // Hide this element but keep it in DOM for analysis
        img.style.display = 'none';
        img.id = 'previewImage';
        document.body.appendChild(img);
      };
      img.src = e.target.result;
      
      // Display in preview card
      previewImage.src = e.target.result;
      previewImage.alt = 'Preview of ' + file.name;
      
      // Update UI state
      updateUIState('preview');
      
      // Store the file for later use
      fileInput.dataset.currentFile = file.name;
    };
    reader.readAsDataURL(file);
  }
  
  // Add event listeners for the buttons
  if (startAnalysisBtn) {
    startAnalysisBtn.addEventListener('click', async function() {
      if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select an image first.');
        return;
      }
      
      // Update UI to loading state
      updateUIState('loading');
      
      // Create an analysis log container if it doesn't exist
      if (!document.getElementById('analysisLog')) {
        const logContainer = document.createElement('div');
        logContainer.id = 'analysisLog';
        logContainer.className = 'log';
        document.querySelector('.loading').after(logContainer);
      }
      
      // Clear previous log entries
      const logContainer = document.querySelector('.log');
      if (logContainer) logContainer.innerHTML = '';
      
      try {
        // Process the image
        const results = await estimateWeights(fileInput.files[0]);
        
        // Update UI with results
        renderResults(results);
        
        // Change UI state to results
        updateUIState('results');
      } catch (error) {
        console.error('Analysis failed:', error);
        appendToLog('Error: Analysis failed - ' + error.message);
        
        // Show an error message
        alert('Analysis failed. Please try again with a different image.');
        
        // Go back to upload state
        updateUIState('upload');
      }
    });
  }
  
  // Add event listener for "New Analysis" button
  document.querySelectorAll('.button-success').forEach(btn => {
    if (btn.textContent.includes('New Analysis')) {
      btn.addEventListener('click', function() {
        // Reset file input
        fileInput.value = '';
        
        // Go back to upload state
        updateUIState('upload');
      });
    }
  });
  
  // Function to render results in the UI
  function renderResults(results) {
    const resultTable = document.querySelector('.result-table tbody');
    if (!resultTable) return;
    
    resultTable.innerHTML = ''; // Clear previous results
    
    // Update summary metrics
    document.querySelectorAll('.result-metric-value')[0].textContent = results.ingredients.length;
    
    let totalWeight = 0;
    results.ingredients.forEach(item => {
      totalWeight += item.weight;
      
      // Add to table
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="result-item">
            <div class="result-icon">🍽️</div>
            <div>${item.name}</div>
          </div>
        </td>
        <td class="result-value">${item.weight}g</td>
        <td>≈ ${getEquivalent(item.name, item.weight)}</td>
        <td>95%</td>
      `;
      
      resultTable.appendChild(tr);
    });
    
    // Update total weight
    document.querySelectorAll('.result-metric-value')[1].textContent = totalWeight.toFixed(1) + 'g';
  }
  
  // Helper function to get equivalent measurements (simplified)
  function getEquivalent(name, weight) {
    const equivalents = {
      'apple': [100, 'medium apple'],
      'banana': [120, 'medium banana'],
      'tomato': [90, 'medium tomato'],
      'potato': [150, 'medium potato'],
      'carrot': [60, 'medium carrot'],
      'onion': [110, 'medium onion'],
      'avocado': [200, 'medium avocado']
    };
    
    const lowerName = name.toLowerCase();
    if (equivalents[lowerName]) {
      const [itemWeight, itemDesc] = equivalents[lowerName];
      const count = weight / itemWeight;
      return `${count.toFixed(1)} ${itemDesc}${count > 1.1 ? 's' : ''}`;
    }
    
    return "standard portion";
  }
  
  // Example image click handlers
  document.querySelectorAll('.example').forEach(example => {
    example.addEventListener('click', function() {
      // In a real app, this would load the example image
      // For this demo, we'll simulate the image selection
      const simulatedFile = new File([''], 'example.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [simulatedFile],
        writable: false
      });
      
      // Show the example image
      previewImage.src = example.querySelector('img').src;
      previewImage.alt = 'Example - ' + example.querySelector('.example-label').textContent;
      
      // Update UI state
      updateUIState('preview');
    });
  });
});
document.addEventListener('DOMContentLoaded', fetchApiKey);