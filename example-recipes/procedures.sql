DELIMITER //

DROP PROCEDURE IF EXISTS createCategory //
CREATE PROCEDURE createCategory (IN category VARCHAR(255), OUT categoryNum INT)
BEGIN
    INSERT INTO categories (category)
    VALUES (category);
    SET categoryNum = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS listCategories //
CREATE PROCEDURE listCategories ()
BEGIN
    SELECT categoryNum, category FROM categories;
END //

DROP PROCEDURE IF EXISTS modifyCategory //
CREATE PROCEDURE modifyCategory (IN categoryNum INT, IN category VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    UPDATE categories SET categories.category = category WHERE categories.categoryNum = categoryNum;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteCategory //
CREATE PROCEDURE deleteCategory (IN categoryNum INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM categories WHERE categories.categoryNum = categoryNum;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS createUnit //
CREATE PROCEDURE createUnit (IN unitName VARCHAR(255), IN value FLOAT, OUT unitNum INT)
BEGIN
    INSERT INTO units (name, value)
    VALUES (unitName, value);
    SET unitNum = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS modifyUnit //
CREATE PROCEDURE modifyUnit (IN unitNum INT, IN name VARCHAR(255), IN value FLOAT, OUT result VARCHAR(255))
BEGIN
    UPDATE units SET units.name = name, units.value = value WHERE units.unitNum = unitNum;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteUnit //
CREATE PROCEDURE deleteUnit (IN unitNum INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM units WHERE units.unitNum = unitNum;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS listUnits //
CREATE PROCEDURE listUnits ()
BEGIN
    SELECT unitNum, name, value FROM units;
END //

DROP PROCEDURE IF EXISTS createRecipe //
CREATE PROCEDURE createRecipe (IN name VARCHAR(255), IN listCategories_category INT, IN servings INT, OUT recipeId INT)
BEGIN
    INSERT INTO recipes (name, categoryNum, servings)
    VALUES (name, listCategories_category, servings);
    SET recipeId = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS lookupRecipe //
CREATE PROCEDURE lookupRecipe (IN name VARCHAR(255))
BEGIN
    SELECT * FROM recipes WHERE recipes.name LIKE name;
END //

DROP PROCEDURE IF EXISTS listRecipes //
CREATE PROCEDURE listRecipes ()
BEGIN
    SELECT recipeId AS _recipeId, name, categories.category, servings, categoryNum AS _categoryNum FROM recipes NATURAL JOIN categories;
END //

DROP PROCEDURE IF EXISTS modifyRecipe //
CREATE PROCEDURE modifyRecipe (IN _recipeId INT, IN name VARCHAR(255), IN listCategories_categoryNum INT, IN servings INT, OUT result VARCHAR(255))
BEGIN
    UPDATE recipes SET recipes.name = name, categoryNum = listCategories_categoryNum, recipes.servings = servings
        WHERE recipeId = _recipeId;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteRecipe //
CREATE PROCEDURE deleteRecipe (IN recipeId INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM ingredients WHERE ingredients.recipeId = recipeId;
    DELETE FROM instructions WHERE instructions.recipeId = recipeId;
    DELETE FROM recipes WHERE recipes.recipeId = recipeId;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteRecipes //
CREATE PROCEDURE deleteRecipes (IN _recipeId JSON, OUT result VARCHAR(255))
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE array_length INT;
    DECLARE curr INT;

    SET array_length = JSON_LENGTH(_recipeId);

    WHILE i <= array_length DO
        SET curr = JSON_EXTRACT(_recipeId, CONCAT('$[', i-1, ']'));
        CALL deleteRecipe(curr, result);

        SET i = i + 1;
    END WHILE;
END //

DROP PROCEDURE IF EXISTS addIngredientsToRecipe //
CREATE PROCEDURE addIngredientsToRecipe (IN _recipeId INT, IN quantity FLOAT, IN listUnits_unit INT, IN ingredient VARCHAR(255))
BEGIN
    SELECT MAX(ingredientNumber) FROM ingredients where recipeId = _recipeId INTO @item;
    IF (@item IS NULL) THEN
        SET @item = 1;
    ELSE
        SET @item = @item + 1;
    END IF;
    INSERT INTO ingredients (recipeId, ingredientNumber, quantity, unitNum, ingredient)
    VALUES (_recipeId, @item, quantity, listUnits_unit, ingredient);
    SELECT i.quantity, units.name, i.ingredient
        FROM ingredients AS i NATURAL JOIN units
        WHERE recipeId = _recipeId ORDER BY ingredientNumber;
END //

DROP PROCEDURE IF EXISTS addInstructionsToRecipe //
CREATE PROCEDURE addInstructionsToRecipe (IN recipeId INT, IN instruction VARCHAR(255))
BEGIN
    SELECT MAX(instructionNumber) FROM instructions where instructions.recipeId = recipeId INTO @item;
    IF (@item IS NULL) THEN
        SET @item = 1;
    ELSE
        SET @item = @item + 1;
    END IF;
    INSERT INTO instructions (recipeId, instructionNumber, instruction)
    VALUES (recipeId, @item, instruction);
    SELECT * FROM instructions WHERE instructions.recipeId = recipeId ORDER BY instructionNumber;
END //

DROP PROCEDURE IF EXISTS insertInstructionsToRecipe //
CREATE PROCEDURE insertInstructionsToRecipe (IN _recipeId INT, IN instructionNumber INT, IN instruction VARCHAR(255))
BEGIN
    DECLARE i INT;
    SELECT MAX(instructionNumber) FROM instructions where recipeId = _recipeId INTO i;

    WHILE i >= instructionNumber DO
        UPDATE instructions AS i 
            SET i.instructionNumber = i+1 WHERE i.instructionNumber = i;
        SET i = i - 1;
    END WHILE;

    INSERT INTO instructions (recipeId, instructionNumber, instruction)
        VALUES (_recipeId, instructionNumber, instruction);
    SELECT _recipeId, i.instructionNumber, i.instruction
        FROM instructions AS i
        WHERE i.recipeId = _recipeId ORDER BY i.instructionNumber;
END //

DROP PROCEDURE IF EXISTS listIngredients //
CREATE PROCEDURE listIngredients (IN recipeId INT)
BEGIN
    SELECT recipeId AS _recipeId, ingredientNumber AS _ingredientNumber, quantity, units.name, ingredient, unitNum AS _unitNum
        FROM ingredients NATURAL JOIN units
        WHERE ingredients.recipeId = recipeId ORDER BY ingredientNumber;
END //

DROP PROCEDURE IF EXISTS modifyIngredient //
CREATE PROCEDURE modifyIngredient (IN _recipeId INT, IN _ingredientNumber INT, IN quantity FLOAT, IN listUnits_unitNum INT, IN ingredient VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    UPDATE ingredients
        SET ingredients.quantity = quantity, ingredients.unitNum = unitNum, ingredients.ingredient = ingredient
        WHERE recipeId = _recipeId AND ingredientNumber = _ingredientNumber;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteIngredient //
CREATE PROCEDURE deleteIngredient (IN recipeId INT, IN ingredientNumber INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM ingredients
        WHERE ingredients.recipeId = recipeId AND ingredients.ingredientNumber = ingredientNumber;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS listInstructions //
CREATE PROCEDURE listInstructions (IN recipeId INT)
BEGIN
    SELECT recipeId AS _recipeId, instructionNumber, instruction
        FROM instructions
        WHERE instructions.recipeId = recipeId ORDER BY instructionNumber;
END //

DROP PROCEDURE IF EXISTS modifyInstruction //
CREATE PROCEDURE modifyInstruction (IN recipeId INT, IN instructionNumber INT, IN instruction VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    UPDATE instructions
        SET instructions.instructions = instructions
        WHERE instructions.recipeId = recipeId AND instructions.instructionNumber = instructionNumber;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteInstruction //
CREATE PROCEDURE deleteInstruction (IN recipeId INT, IN instructionNumber INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM instructions
        WHERE instructions.recipeId = recipeId AND instructions.instructionNumber = instructionNumber;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS showRecipe //
CREATE PROCEDURE showRecipe (IN recipeId INT)
BEGIN
    SELECT * FROM recipes WHERE recipes.recipeId = recipeId;
    CALL listIngredients(recipeId);
    CALL listInstructions(recipeId);
    CALL getTagsForRecipe(recipeId);
END //

DROP PROCEDURE IF EXISTS createTag //
CREATE PROCEDURE createTag (IN tag VARCHAR(255), OUT tagId INT)
BEGIN
    INSERT INTO tags (tag) VALUES (tag);
    SET tagId = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS listTags //
CREATE PROCEDURE listTags ()
BEGIN
    SELECT * FROM tags;
END //

DROP PROCEDURE IF EXISTS modifyTag //
CREATE PROCEDURE modifyTag (IN _tagId INT, IN tag VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    UPDATE tags SET tags.tag = tag WHERE tags.tagId = tag;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deleteTag //
CREATE PROCEDURE deleteTag (IN tagId INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM tags WHERE tags.tagId = tagId;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS addTagToRecipe //
CREATE PROCEDURE addTagToRecipe (IN _recipeId INT, IN listTags_tagId INT, OUT result VARCHAR(255))
BEGIN
    INSERT INTO recipetags (recipeId, tagId) VALUES (_recipeId, listTags_tagId);
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS removeTagFromRecipe //
CREATE PROCEDURE removeTagFromRecipe (IN recipeId INT, IN tagId INT, OUT result VARCHAR(255))
BEGIN
    DELETE FROM recipetags AS r WHERE r.recipeId = recipeId AND r.tagId = tagId;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS getTagsForRecipe //
CREATE PROCEDURE getTagsForRecipe (IN recipeId INT)
BEGIN
    SELECT recipeId as _recipeId, tagId as _tagId, tag
        FROM recipetags AS r NATURAL JOIN tags
        WHERE r.recipeId = recipeId;
END //

DROP PROCEDURE IF EXISTS findRecipesByTag //
CREATE PROCEDURE findRecipesByTag (IN listTags_tagId INT)
BEGIN
    SELECT recipeId AS _recipeId, name, categories.category, servings, categoryNum AS _categoryNum
        FROM recipes NATURAL JOIN categories NATURAL JOIN recipetags
        WHERE tagId = listTags_tagId;
END //

DELIMITER ;

CREATE ROLE IF NOT EXISTS normalUser;

GRANT EXECUTE ON PROCEDURE createCategory TO normalUser;
GRANT EXECUTE ON PROCEDURE listCategories TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyCategory TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteCategory TO normalUser;
GRANT EXECUTE ON PROCEDURE createUnit TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyUnit TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteUnit TO normalUser;
GRANT EXECUTE ON PROCEDURE listUnits TO normalUser;
GRANT EXECUTE ON PROCEDURE createRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE lookupRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE listRecipes TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteRecipes TO normalUser;
GRANT EXECUTE ON PROCEDURE addIngredientsToRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE addInstructionsToRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE insertInstructionsToRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE listIngredients TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyIngredient TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteIngredient TO normalUser;
GRANT EXECUTE ON PROCEDURE listInstructions TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyInstruction TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteInstruction TO normalUser;
GRANT EXECUTE ON PROCEDURE showRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE createTag TO normalUser;
GRANT EXECUTE ON PROCEDURE listTags TO normalUser;
GRANT EXECUTE ON PROCEDURE modifyTag TO normalUser;
GRANT EXECUTE ON PROCEDURE deleteTag TO normalUser;
GRANT EXECUTE ON PROCEDURE addTagToRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE removeTagFromRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE getTagsForRecipe TO normalUser;
GRANT EXECUTE ON PROCEDURE findRecipesByTag TO normalUser;
