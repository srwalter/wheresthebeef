DELIMITER //

DROP PROCEDURE IF EXISTS createPart //
CREATE PROCEDURE createPart (IN description VARCHAR(255), IN price DECIMAL(10, 2), OUT partNumber INT)
BEGIN
    INSERT INTO catalog (description, price)
    VALUES (description, price);
    SET partNumber = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS modifyPart //
CREATE PROCEDURE modifyPart (IN partNumber INT, IN description VARCHAR(255), IN price DECIMAL(10, 2), OUT result VARCHAR(255))
BEGIN
    SET @description = description;
    SET @price = price;
    UPDATE catalog SET description = @description, price = @price WHERE catalog.partNumber = partNumber;
    SET result = "Success";
END //

DROP PROCEDURE IF EXISTS deletePart //
CREATE PROCEDURE deletePart (IN partNumber INT)
BEGIN
    SET @partNumber = partNumber;
    DELETE FROM catalog WHERE partNumber = @partNumber;
END //

DROP PROCEDURE IF EXISTS listParts //
CREATE PROCEDURE listParts (IN paginate_count INT, IN paginate_offset INT, OUT paginate_total INT)
BEGIN
    SELECT COUNT(*) FROM catalog INTO paginate_total;
    SELECT * FROM catalog LIMIT paginate_count OFFSET paginate_offset;
END //

DROP PROCEDURE IF EXISTS lookupPart //
CREATE PROCEDURE lookupPart (IN description VARCHAR(255))
BEGIN
    SELECT * FROM catalog WHERE catalog.description LIKE description;
END //

DROP PROCEDURE IF EXISTS createCustomer //
CREATE PROCEDURE createCustomer (IN firstName VARCHAR(255), IN lastName VARCHAR(255), OUT customerNumber INT )
BEGIN
    INSERT INTO customers (firstName, lastName)
    VALUES (firstName, lastName);
    SET customerNumber = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS lookupCustomer //
CREATE PROCEDURE lookupCustomer (IN firstName VARCHAR(255), IN lastName VARCHAR(255))
BEGIN
    SELECT * FROM customers WHERE customers.firstName LIKE firstName AND customers.lastName LIKE lastName;
END //

DROP PROCEDURE IF EXISTS createOrder //
CREATE PROCEDURE createOrder (IN customerNumber INT, OUT orderNumber INT )
BEGIN
    INSERT INTO orders (customerNumber)
    VALUES (customerNumber);
    SET orderNumber = LAST_INSERT_ID();
END //

DROP PROCEDURE IF EXISTS lookupOrder //
CREATE PROCEDURE lookupOrder (IN firstName VARCHAR(255), IN lastName VARCHAR(255))
BEGIN
    SET @firstName = firstName;
    SET @lastName = lastName;
    SELECT * FROM orders NATURAL JOIN customers WHERE customer.firstName LIKE firstName AND customer.lastName LIKE @lastName;
END //

DROP PROCEDURE IF EXISTS addItemToOrder //
CREATE PROCEDURE addItemToOrder (IN orderNumber INT, IN partNumber INT, OUT subTotal INT)
BEGIN
    SELECT MAX(itemNumber) FROM orderItems where customer.orderNumber = orderNumber INTO @item;
    IF (@item IS NULL) THEN
        SET @item = 1;
    ELSE
        SET @item = @item + 1;
    END IF;
    INSERT INTO orderItems (itemNumber, orderNumber, partNumber)
    VALUES (@item, orderNumber, partNumber);
    SELECT itemNumber, description, price FROM orderItems NATURAL JOIN catalog WHERE orderItems.orderNumber = orderNumber ORDER BY itemNumber;
    SELECT SUM(price) FROM orderItems NATURAL JOIN catalog WHERE orderItems.orderNumber = orderNumber INTO subTotal;
END //

DROP PROCEDURE IF EXISTS showOrder //
CREATE PROCEDURE showOrder (IN orderNumber INT, OUT subTotal DECIMAL(10,2), OUT taxes DECIMAL(10,2), OUT total DECIMAL(10,2))
BEGIN
    SET @orderNumber = orderNumber;
    SELECT orderNumber, firstName, lastName FROM orders NATURAL JOIN customers WHERE orders.orderNumber = orderNumber;
    SELECT itemNumber, description, price FROM orderItems NATURAL JOIN catalog WHERE orders.orderNumber = orderNumber ORDER BY itemNumber;
    SELECT SUM(price) FROM orderItems NATURAL JOIN catalog WHERE orders.orderNumber = orderNumber INTO subTotal;
    SET taxes = subTotal * 0.06;
    SET total = subTotal + taxes;
END //

DELIMITER ;

CREATE ROLE IF NOT EXISTS normal_user;

GRANT EXECUTE ON PROCEDURE createPart TO normal_user;
GRANT EXECUTE ON PROCEDURE listParts TO normal_user;
