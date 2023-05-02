DELIMITER //

DROP PROCEDURE IF EXISTS createUser //
CREATE PROCEDURE createUser (IN username VARCHAR(255), IN password VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    SET @sql = CONCAT('CREATE USER ''', username, '''@''%'' IDENTIFIED BY ''', password, '''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET @sql = CONCAT('GRANT EXECUTE ON PROCEDURE changePassword TO ''', username, '''@''%''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS changePassword //
CREATE PROCEDURE changePassword (IN password VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    SET @sql = CONCAT('SET PASSWORD = ''', password, ''';');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS grantRole //
CREATE PROCEDURE grantRole (IN username VARCHAR(255), IN role VARCHAR(255), OUT result VARCHAR(255))
BEGIN
    SET @sql = CONCAT('GRANT ', role, ' TO ''', username, '''@''%''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET @sql = CONCAT('ALTER USER ''', username, '''@''%'' DEFAULT ROLE ', role, ';');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET result = "Success";
END //

DELIMITER ;
