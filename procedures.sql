DELIMITER //

DROP PROCEDURE IF EXISTS createUser //
CREATE PROCEDURE createUser (IN username VARCHAR(255), IN password VARCHAR(255))
BEGIN
    SET @sql = CONCAT('CREATE USER ''', username, '''@''%'' IDENTIFIED BY ''', password, '''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //

DROP PROCEDURE IF EXISTS grantRole //
CREATE PROCEDURE grantRole (IN username VARCHAR(255), IN role VARCHAR(255))
BEGIN
    SET @sql = CONCAT('GRANT ', role, ' TO ''', username, '''@''%''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //

DELIMITER ;
