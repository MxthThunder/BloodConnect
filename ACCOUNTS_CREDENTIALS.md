# BloodConnect — Authentication Credentials Guide

This document lists all pre-configured login accounts for the **BloodConnect** Emergency Blood Coordination Network. You can use any of these credentials on the [Login Page](http://localhost:5173/login) to access and evaluate the platform.

---

## 1. System Administrator Accounts
> **Access Level**: Full Administrative Command & Control Portal (`/admin-portal/dashboard`)  
> **Features**: Verification triage queue, emergency request dispatch, blood bank inventory management, low-stock threshold monitoring, audit logging.

| Name | Username | Email | Password | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Freddy Matthew R** | `freddy.admin` | `freddy.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **Joshua Bennet C** | `joshua.admin` | `joshua.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **Boopathi P R** | `boopathi.admin` | `boopathi.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **Balakumaran E** | `balakumaran.admin` | `balakumaran.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **Abilash Alexander A** | `abilash.admin` | `abilash.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **Harisankaran J** | `harisankaran.admin` | `harisankaran.admin@bloodconnect.org` | `Admin@1234` | Administrator |
| **System Admin Desk** | `admin` | `admin@bloodconnect.org` | `Admin@1234` | Administrator |

*Note: You can type either the **Username** (e.g. `freddy.admin`) or the **Email** (e.g. `freddy.admin@bloodconnect.org`) in the login field.*

---

## 2. Emergency Blood Requester Accounts
> **Access Level**: Patient & Hospital Requester Portal (`/requester/dashboard`)  
> **Features**: Create emergency blood requests, real-time donor matching view, track fulfillment status, locality selection across 15 Chennai zones.

| Name / Locality | Email / Identifier | Password | Role |
| :--- | :--- | :--- | :--- |
| **Ananya Sharma** (T. Nagar) | `requester@bloodconnect.org` | `Requester@1234` | Requester |
| **Kavitha S** (Velachery) | `requester.kavitha@bloodconnect.org` | `Requester@1234` | Requester |
| **Karthik R** (Anna Nagar) | `requester.karthik@bloodconnect.org` | `Requester@1234` | Requester |

---

## 3. Voluntary Emergency Blood Donor Accounts
> **Access Level**: Voluntary Donor Portal (`/donor/dashboard`)  
> **Features**: View emergency alerts matching blood group & locality, confirm donation willingness, view donation history & verified certificates.

| Name | Blood Group | Locality | Email / Identifier | Password | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vikram Malhotra** | **O- (Universal Donor)** | Adyar | `donor.o_neg@bloodconnect.org` | `Donor@1234` | Donor |
| **Rahul Deshmukh** | **A+** | Nungambakkam | `donor.a_pos@bloodconnect.org` | `Donor@1234` | Donor |
| **Aravind K** | **B+** | Guindy | `donor.b_pos@bloodconnect.org` | `Donor@1234` | Donor |
| **Nandhini S** | **AB+** | Mylapore | `donor.ab_pos@bloodconnect.org` | `Donor@1234` | Donor |
| **Senthil Nathan** | **O+** | Tambaram | `donor.o_pos@bloodconnect.org` | `Donor@1234` | Donor |
| **Murali K** | **A-** | Chromepet | `donor.a_neg@bloodconnect.org` | `Donor@1234` | Donor |
| **Harini V** | **B-** | Thiruvanmiyur | `donor.b_neg@bloodconnect.org` | `Donor@1234` | Donor |
| **Ganesh R** | **AB- (Rare)** | Porur | `donor.ab_neg@bloodconnect.org` | `Donor@1234` | Donor |

---

## How to Log In & Navigate

1. **Accessing the Login Page**:
   - Go to [http://localhost:5173/login](http://localhost:5173/login) directly, or click **"Sign In"** in the top navigation bar or the **"Sign In to Portal"** button on the homepage hero.
2. **Logging In**:
   - Enter any Email or Username from the tables above.
   - Enter the matching Password.
   - Click **"Sign In to Portal"**.
3. **Switching Accounts or Signing Out**:
   - When signed in, click the **"Sign Out"** button in the top navigation bar or the internal dashboard sidebar to return to the public portal or switch to another user role.
4. **Registering a New Account**:
   - Anyone can create a new Requester or Donor account via the [Registration Page](http://localhost:5173/register).
