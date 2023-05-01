CREATE TABLE catalog ( partNumber INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(255), price DECIMAL(10, 2) );

CREATE TABLE customers ( customerNumber INT AUTO_INCREMENT PRIMARY KEY, firstName VARCHAR(255), lastName VARCHAR(255) );

CREATE TABLE ordertypes ( orderType INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(255) );

CREATE TABLE orders ( orderNumber INT AUTO_INCREMENT PRIMARY KEY, customerNumber INT, orderType INT,
    FOREIGN KEY (orderType) REFERENCES ordertypes(orderType),
    FOREIGN KEY (customerNumber) REFERENCES customers(customerNumber) );

CREATE TABLE orderItems ( orderNumber INT, itemNumber INT, partNumber INT, FOREIGN KEY (partNumber) REFERENCES catalog(partNumber), FOREIGN KEY (orderNumber) REFERENCES orders(orderNumber), PRIMARY KEY (orderNumber, itemNumber) );
