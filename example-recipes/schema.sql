CREATE TABLE categories (categoryNum INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(255));

CREATE TABLE recipes (recipeId INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), categoryNum INT, servings INT,
    FOREIGN KEY (categoryNum) REFERENCES categories(categoryNum));

CREATE TABLE units (unitNum INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), value FLOAT);

CREATE TABLE ingredients (recipeId INT, ingredientNumber INT, quantity FLOAT, unitNum INT, ingredient VARCHAR(255),
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId),
    FOREIGN KEY (unitNum) REFERENCES units(unitNum),
    PRIMARY KEY (recipeId, ingredientNumber));

CREATE TABLE instructions (recipeId INT, instructionNumber INT, instruction VARCHAR(255),
    FOREIGN KEY (recipeId) REFERENCES recipes(recipeId),
    PRIMARY KEY (recipeId, instructionNumber));

CREATE TABLE tags (tagId INT AUTO_INCREMENT PRIMARY KEY, tag VARCHAR(255));

CREATE TABLE recipetags (recipeId INT, tagId INT,
    PRIMARY KEY (recipeId, tagId));
