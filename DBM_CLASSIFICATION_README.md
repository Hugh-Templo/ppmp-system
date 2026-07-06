# DBM Classification Feature

## Overview
This feature implements DBM (Department of Budget and Management) classification codes for PS-DBM (Procurement Service - Department of Budget and Management) compliance. It allows BAC administrators to manage and view DBM classification codes that categorize procurement items according to government standards.

## Features
- View all DBM classifications in the BAC Admin dashboard
- Add new DBM classification codes
- Delete existing DBM classification codes
- Search and filter DBM classifications

## Database Schema
The DBMClassification table includes:
- `id`: Primary key
- `code`: Unique DBM classification code (e.g., "101", "202")
- `project_title`: Title of the classification category
- `classification`: Type of classification (e.g., "Common-Use Supplies and Equipment (CSE)", "Specialized Equipment")
- `description`: Detailed description of the classification
- `created_at`: Timestamp when the classification was created

## API Endpoints
- `GET /api/dbm/classifications` - List all DBM classifications
- `POST /api/dbm/classifications` - Create a new DBM classification
- `GET /api/dbm/classifications/{id}` - Get a specific DBM classification
- `DELETE /api/dbm/classifications/{id}` - Delete a DBM classification

## Initial Data
The `dbm_classification_init.sql` file contains initial DBM classification data for common procurement categories.