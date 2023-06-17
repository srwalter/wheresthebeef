DELIMITER //

DROP PROCEDURE IF EXISTS createUser //
CREATE PROCEDURE createUser (IN username VARCHAR(255), IN password VARCHAR(255), OUT result VARCHAR(255))
SQL SECURITY INVOKER
BEGIN
    SET @sql = CONCAT('CREATE USER ''', username, '''@''localhost'' IDENTIFIED BY ''', password, '''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;

    SET @sql = CONCAT('GRANT EXECUTE ON PROCEDURE changePassword TO ''', username, '''@''localhost''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;

    SET @sql = CONCAT('GRANT EXECUTE ON PROCEDURE listRoutines TO ''', username, '''@''localhost''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;

    SET @sql = CONCAT('GRANT EXECUTE ON PROCEDURE inspectProcedure TO ''', username, '''@''localhost''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS changePassword //
CREATE PROCEDURE changePassword (IN newPassword VARCHAR(255), IN passwordAgain VARCHAR(255), OUT result VARCHAR(255))
SQL SECURITY INVOKER
BEGIN
    IF newPassword = passwordAgain THEN
        SET @sql = CONCAT('SET PASSWORD = ''', newPassword, ''';');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SET result = "Success";
    ELSE
        SET result = "Passwords don't match";
    END IF;
END //

DROP PROCEDURE IF EXISTS grantRole //
CREATE PROCEDURE grantRole (IN username VARCHAR(255), IN listRoles_role VARCHAR(255), OUT result VARCHAR(255))
SQL SECURITY INVOKER
BEGIN
    SET @sql = CONCAT('GRANT ', role, ' TO ''', username, '''@''localhost''');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;

    SET @sql = CONCAT('ALTER USER ''', username, '''@''localhost'' DEFAULT ROLE ', role, ';');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS listRoutines //
CREATE PROCEDURE listRoutines ()
BEGIN
    SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_SCHEMA = DATABASE();
END //

DROP PROCEDURE IF EXISTS inspectProcedure //
CREATE PROCEDURE inspectProcedure (IN proc_name VARCHAR(255))
BEGIN
    SELECT PARAMETER_MODE, PARAMETER_NAME, DATA_TYPE, DTD_IDENTIFIER FROM INFORMATION_SCHEMA.PARAMETERS WHERE SPECIFIC_NAME = proc_name AND SPECIFIC_SCHEMA = DATABASE();
END //

DELIMITER ;

