document.addEventListener("DOMContentLoaded", () => {
    const boxes = document.querySelectorAll(".popup-box");
    const popupBlur = document.getElementById("popupBlur");
    const popupContainer = document.getElementById("popupContainer");
    const form = document.querySelector(".message-form");
    const input = form.querySelector("input");
    const chatbox = document.getElementById("chatbox");

    popupBlur.style.display = "block";

    boxes.forEach((box, index) => {
        setTimeout(() => {
            box.classList.add("show");
        }, index * 300);
    });

    boxes.forEach((box, index) => {
        box.addEventListener("click", () => {
            popupContainer.remove();
            popupBlur.style.display = "none";

            if (index === 0) {
                startDishNameChat();
            } else if (index === 1) {
                startIngredientsChat();
            }
        });
    });

    let conversationState = "";
    let dishName = "";
    let servings = "";
    let ingredients = [];
    let chatHistory = [];

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        handleUserInput();
    });

    async function handleUserInput() {
        let userMessage = input.value.trim();
        if (!userMessage) return;

        addMessage("You", userMessage);
        input.value = "";

        switch (conversationState) {
            case "askDish":
                dishName = userMessage;
                conversationState = "askServingsForDish";
                addMessage("Reci-Bot", "Great choice! How many servings do you need?", true);
                break;

            case "askServingsForDish":
                servings = userMessage;
                conversationState = "processingRecipe";
                await fetchRecipe(`Dish Name: ${dishName}`, dishName, servings);
                break;

            case "askIngredients":
                ingredients = userMessage.split(",").map(i => i.trim());
                conversationState = "askServingsForIngredients";
                addMessage("Reci-Bot", "How many servings do you need?", true);
                break;

            case "askServingsForIngredients":
                servings = userMessage;
                conversationState = "processingRecipe";
                await fetchRecipe(`Ingredients: ${ingredients.join(", ")}`, "Custom Recipe", servings);
                break;

            case "chat":
                await getChatResponse(userMessage);
                break;
        }
    }

    function addMessage(sender, message, isBot = false) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `chat-message ${isBot ? 'bot' : 'user'}`;

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.innerHTML = isBot ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

        const content = document.createElement("div");
        content.className = "message-content";
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;

        if (isBot) {
            typeWriterEffect(content, `<strong>${sender}:</strong> ${message}`);
        } else {
            content.innerHTML = `<strong>${sender}:</strong> ${message}`;
        }
    }

    function typeWriterEffect(element, text, speed = 30) {
        let i = 0;
        element.innerHTML = ""; // Clear content before typing effect

        function type() {
            if (i < text.length) {
                element.innerHTML = text.substring(0, i + 1); // Use substring to keep HTML formatting
                i++;
                setTimeout(type, speed);
            } else {
                if (conversationState === "processingRecipe") {
                    setTimeout(() => {
                        conversationState = "askDish";
                        addMessage("Reci-Bot", "Would you like to cook something else? Let's start over!", true);
                    }, 2000);
                }
            }
        }

        type();
    }

    function startDishNameChat() {
        conversationState = "askDish";
        addMessage("Reci-Bot", "Hello! What dish would you like to cook?", true);
    }

    function startIngredientsChat() {
        conversationState = "askIngredients";
        addMessage("Reci-Bot", "Hello! Please list your ingredients, separated by commas.", true);
    }

    async function fetchRecipe(promptDetails, title, servings) {
        const API_KEY = "AIzaSyArqHLl54_0nFtYrFcs-8KRpPCvSMSDvO4";
        const promptText = `As a professional chef, provide a detailed recipe including:
        - ${promptDetails}
        - Number of servings: ${servings}
        - **All ingredient measurements in grams only not in teaspoon**
        - **Step-by-step cooking instructions**
        - **Nutritional information**
        - **Possible ingredient substitutions**
        - **Top 3 related YouTube videos**
        - Format response with clear **bold headings**.`;

        // Show "Generating..." animation before API response
        const generatingDiv = document.createElement("div");
        generatingDiv.className = "recipe-result";
        generatingDiv.innerHTML = `<h2>🍽️ Generating your recipe...</h2>
                                   <div class="generating-animation">Please wait...</div>`;
        chatbox.appendChild(generatingDiv);
        chatbox.scrollTop = chatbox.scrollHeight;

        try {
            // First, check if API key is properly formatted
            if (!API_KEY || API_KEY.length < 20) {
                throw new Error("API key appears to be invalid or missing");
            }
            
            // Fixed API endpoint to use the correct model name and API version
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: promptText }] }]
                })
            });

            // Check for non-200 responses
            if (!response.ok) {
                const errorResponse = await response.json();
                console.error("API Error:", response.status, errorResponse);
                addMessage("Reci-Bot", `API Error: ${errorResponse.error?.message || "Unknown error"}`, true);
                throw new Error(`API returned ${response.status}: ${JSON.stringify(errorResponse)}`);
            }

            const data = await response.json();
            console.log("API Response:", data); // Log full response for debugging
            
            // Remove the generating animation
            if (chatbox.contains(generatingDiv)) {
                chatbox.removeChild(generatingDiv);
            }

            // More comprehensive checking of response structure
            if (data?.candidates?.length > 0 && 
                data.candidates[0]?.content?.parts?.length > 0 && 
                data.candidates[0].content.parts[0]?.text) {
                
                const recipeText = data.candidates[0].content.parts[0].text;
                await displayFormattedRecipe(title, servings, recipeText);
            } else if (data?.error) {
                // If the API returns an error object
                console.error("API returned error:", data.error);
                addMessage("Reci-Bot", `Error: ${data.error.message || "Unknown API error"}`, true);
            } else {
                // If the API returned success but with unexpected format
                console.error("Unexpected API response format:", data);
                addMessage("Reci-Bot", "I couldn't generate a recipe. The API response format was unexpected.", true);
            }
        } catch (error) {
            console.error("Error in fetchRecipe:", error);
            
            // Remove the generating animation if it's still there
            if (chatbox.contains(generatingDiv)) {
                chatbox.removeChild(generatingDiv);
            }
            
            // Give more specific error messages based on the error
            if (error.message.includes("Failed to fetch")) {
                addMessage("Reci-Bot", "Couldn't connect to the recipe service. Please check your internet connection.", true);
            } else if (error.message.includes("API key")) {
                addMessage("Reci-Bot", "There seems to be an issue with the API key. Please contact support.", true);
            } else if (error.message.includes("API returned")) {
                addMessage("Reci-Bot", "The recipe service returned an error. It might be temporarily unavailable.", true);
            } else {
                addMessage("Reci-Bot", `Oops! Something went wrong: ${error.message}`, true);
            }
        }
    }

    async function displayFormattedRecipe(title, servings, recipeText) {
        return new Promise((resolve) => {
            const recipeContainer = document.createElement("div");
            recipeContainer.className = "recipe-result";
    
            recipeContainer.innerHTML = `<h2>🍽️ Recipe for ${title} (${servings} servings)</h2>
                                         <div class="recipe-content generating-animation">Generating your recipe...</div>`;
            chatbox.appendChild(recipeContainer);
            chatbox.scrollTop = chatbox.scrollHeight;
    
            setTimeout(() => {
                const recipeContent = recipeContainer.querySelector('.recipe-content');
                recipeContent.className = "recipe-content typing-animation";
                let finalContent = recipeText
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Make bold text work
                    .replace(/\n/g, "<br>"); // Preserve line breaks
    
                let i = 0;
                function typeWriter() {
                    if (i < finalContent.length) {
                        recipeContent.innerHTML = finalContent.substring(0, i + 1);
                        i++;
                        setTimeout(typeWriter, 5); // Controls typing speed
                    } else {
                        // Ensure a 3-second delay before asking for a new dish
                        setTimeout(() => {
                            addMessage("Reci-Bot", "Would you like to cook something else? Let's start over!", true);
                            conversationState = "askDish"; // Reset the chatbot state for a new recipe
                        }, 3000); // Waits 3 seconds before restarting
                        resolve();
                    }
                }
                typeWriter();
            }, 1000);
        });
    }
    
    // Add getChatResponse function placeholder in case it's needed later
    async function getChatResponse(userMessage) {
        // This function is mentioned in the switch case but not implemented
        // Adding a placeholder for completeness
        console.log("Chat response requested for:", userMessage);
        addMessage("Reci-Bot", "I'm a recipe bot. Please ask me about recipes!", true);
    }
});