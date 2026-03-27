-- Run this once to create the cost center accounts table
CREATE TABLE IF NOT EXISTS cost_center_accounts (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    cost_center   VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- Insert all 18 cost centers with default password: "costcenter123"
-- Replace the hashes below with your own using PHP's password_hash()
-- php -r "echo password_hash('costcenter123', PASSWORD_DEFAULT);"

INSERT INTO cost_center_accounts (cost_center, password_hash) VALUES
('Laboratory',              '$2y$10$examplehashreplaceme1111111111111111111111111111111111'),
('Ward',                    '$2y$10$examplehashreplaceme2222222222222222222222222222222222'),
('Radiology',               '$2y$10$examplehashreplaceme3333333333333333333333333333333333'),
('Radio Therapy',           '$2y$10$examplehashreplaceme4444444444444444444444444444444444'),
('Procedure',               '$2y$10$examplehashreplaceme5555555555555555555555555555555555'),
('Physical Therapy',        '$2y$10$examplehashreplaceme6666666666666666666666666666666666'),
('Pharmacy',                '$2y$10$examplehashreplaceme7777777777777777777777777777777777'),
('Out Patient Department',  '$2y$10$examplehashreplaceme8888888888888888888888888888888888'),
('Parenatal',               '$2y$10$examplehashreplaceme9999999999999999999999999999999999'),
('Opthalmology',            '$2y$10$examplehashreplacemeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
('Operating Room',          '$2y$10$examplehashreplacemeBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
('Nuclear Medicine',        '$2y$10$examplehashreplacemeCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'),
('Neurology',               '$2y$10$examplehashreplacemeDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'),
('Emergency Room',          '$2y$10$examplehashreplacemeEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE'),
('Dermatology',             '$2y$10$examplehashreplacemeFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
('Dental',                  '$2y$10$examplehashreplacemeGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'),
('Central Supply Room',     '$2y$10$examplehashreplacemeHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH'),
('Delivery Room',           '$2y$10$examplehashreplacemeIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII');
