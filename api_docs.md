# Brahmadeva Constructions API Documentation

This document provides details on the available API endpoints for the Brahmadeva Constructions backend application.

## Base URL

All URLs are relative to the base URL of the server (e.g., `http://localhost:3000`).

---

## 1. Authentication & Users

Endpoints for user management and authentication.

### Login

- **URL:** `/login`
- **Method:** `POST`
- **Description:** Authenticates a user and returns a JWT token.
- **Payload:**
  ```json
  {
    "phone": "user_phone_number",
    "password": "user_password"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Verify Token

- **URL:** `/verify-token`
- **Method:** `POST`
- **Description:** Checks if a JWT token is valid.
- **Payload:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Success Response (200):**
  ```json
  {
    "valid": true
  }
  ```

### Get All Users

- **URL:** `/users`
- **Method:** `GET`
- **Description:** Retrieves a list of all users.
- **Payload:** None
- **Success Response (200):**
  ```json
  [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "role": "admin",
      "createdAt": "2023-01-01T12:00:00.000Z",
      "updatedAt": "2023-01-01T12:00:00.000Z"
    }
  ]
  ```

### Create User

- **URL:** `/users`
- **Method:** `POST`
- **Description:** Creates a new user.
- **Payload:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "phone": "0987654321",
    "role": "user",
    "password": "securepassword123"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "id": 2,
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "phone": "0987654321",
    "role": "user",
    "updatedAt": "2023-01-02T12:00:00.000Z",
    "createdAt": "2023-01-02T12:00:00.000Z"
  }
  ```

### Update User FCM Token

- **URL:** `/users/fcm-token`
- **Method:** `PATCH`
- **Description:** Updates the Firebase Cloud Messaging (FCM) token for a user.
- **Payload:**
  ```json
  {
    "id": 1,
    "fcm_token": "new_fcm_token_string"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "message": "FCM token updated successfully"
  }
  ```

---

## 2. Items

CRUD operations for managing inventory or service items.

### Get All Items

- **URL:** `/items`
- **Method:** `GET`
- **Description:** Retrieves a list of all items, sorted by creation date.
- **Payload:** None
- **Success Response (200):**
  ```json
  [
    {
      "id": 1,
      "description": "Cement Bag",
      "price": 450.0,
      "unit": "bag",
      "gst": 18.0,
      "createdAt": "2023-01-01T12:00:00.000Z",
      "updatedAt": "2023-01-01T12:00:00.000Z"
    }
  ]
  ```

### Get Item by ID

- **URL:** `/items/:id`
- **Method:** `GET`
- **Description:** Retrieves a single item by its ID.
- **Payload:** None
- **Success Response (200):**
  ```json
  {
    "id": 1,
    "description": "Cement Bag",
    "price": 450.0,
    "unit": "bag",
    "gst": 18.0,
    "createdAt": "2023-01-01T12:00:00.000Z",
    "updatedAt": "2023-01-01T12:00:00.000Z"
  }
  ```

### Create Item

- **URL:** `/items`
- **Method:** `POST`
- **Description:** Creates a new item.
- **Payload:**
  ```json
  {
    "description": "Steel TMT Bar",
    "price": 65.0,
    "unit": "kg",
    "gst": 18.0
  }
  ```
- **Success Response (201):** (Returns the newly created item object)

### Update Item

- **URL:** `/items/:id`
- **Method:** `PATCH`
- **Description:** Updates an existing item's details.
- **Payload:** (Any subset of the fields)
  ```json
  {
    "price": 460.0,
    "gst": 28.0
  }
  ```
- **Success Response (200):** (Returns the updated item object)

### Delete Item

- **URL:** `/items/:id`
- **Method:** `DELETE`
- **Description:** Deletes an item by its ID.
- **Payload:** None
- **Success Response (200):**
  ```json
  {
    "message": "Item deleted successfully"
  }
  ```

---

## 3. Leads

Endpoints for managing sales leads.

### Get Leads

- **URL:** `/leads`
- **Method:** `GET`
- **Description:** Retrieves leads. Admins get all leads; other users get leads they have access to. Requires authentication.
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Payload:** None
- **Success Response (200):** (Returns an array of lead objects)

### Get Lead by ID

- **URL:** `/leads/:id`
- **Method:** `GET`
- **Description:** Retrieves a single lead by its ID, along with associated user and status lists.
- **Payload:** None
- **Success Response (200):**
  ```json
  {
    "id": 1,
    "name": "Lead Name",
    "contact": "1234567890",
    "city": "Pune",
    "response": "new",
    "comment": [],
    "access": [1, 2],
    "status": ["Interested", "Not Interested", ...],
    "userList": [{"id": 1, "name": "User One"}, {"id": 2, "name": "User Two"}]
  }
  ```

### Create Meta Lead (Webhook)

- **URL:** `/meta-leads`
- **Method:** `POST`
- **Description:** Endpoint for a webhook (e.g., from Facebook/Meta) to create a new lead.
- **Payload:**
  ```json
  {
    "name": "New Lead",
    "contact": "1122334455",
    "city": "Mumbai",
    "time": "2023-10-27T10:00:00Z",
    "platform": "Facebook"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "message": "Lead saved and alerts sent",
    "data": { ... } // The newly created lead object
  }
  ```

### Update Lead

- **URL:** `/leads/:id`
- **Method:** `PATCH`
- **Description:** Updates a lead's status, comments, schedule, or access permissions.
- **Payload:**
  ```json
  {
    "response": "Interested",
    "newComment": "Called the client, they are interested.",
    "user": "Admin",
    "visit_schedule": "2023-11-15T14:00:00Z",
    "access": [1, 3]
  }
  ```
- **Success Response (200):** (Returns the updated lead object)

---

## 4. Site Visits & File Uploads

### Create Site Details

- **URL:** `/site-details`
- **Method:** `POST`
- **Description:** Records a new site visit, including details and images.
- **Payload:**
  ```json
  {
    "token": "user_jwt_token",
    "ownerName": "Site Owner",
    "ownerContact": "555-1234",
    "locationImage": ["data:image/jpeg;base64,..."],
    "selfie": "data:image/jpeg;base64,..."
  }
  ```
- **Success Response (201):**
  ```json
  {
    "message": "✅ Site details saved successfully"
  }
  ```

### Get All Site Visits

- **URL:** `/all-visits`
- **Method:** `GET`
- **Description:** Retrieves all site visit records.
- **Payload:** None
- **Success Response (200):**
  ```json
  {
    "visits": [ ... ] // Array of site detail objects
  }
  ```