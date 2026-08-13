# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Drop 'N Roll Project Specifications

## 1. Project Overview & Objectives

The primary goal of the Drop 'N Roll platform is to deliver a fast, reliable, and user-friendly B2B and B2C courier service across a national scale. The platform will connect customers needing to send parcels with a network of available drivers, offering tiered services and advanced tracking. Objectives include:

- Provide a seamless platform for booking and tracking with services: Same-Day/Next-Day Delivery, 1-2 Hour Urban Drop, and Scheduled Pickups.
- Offer real-time GPS tracking with live updates for users and admins.
- Enable business solutions such as scheduled pickups and B2B monthly plans with discounted rates.
- Ensure a secure, fast, and dependable delivery experience nationwide.
- Develop admin and driver dashboards for efficient fleet and delivery management.
- Integrate an instant quote system based on weight, distance, and delivery speed.

## 2. Target Audience

- **B2C Individual Customers**: Urban consumers, students, professionals needing quick parcel delivery.
- **B2B Business Customers**: Small e-commerce businesses, SMEs, online sellers (eBay, Etsy), local businesses requiring same-day solutions.
- **Enterprise Clients**: Large corporations needing bulk delivery and tailored business plans.
- **Specialized Sectors**: Law firms, clinics (secure document delivery), food producers, florists (temperature-controlled transport), and subscription box sellers.

## 3. Location

- Initial launch in key urban hubs (e.g., Milton Keynes, Oxford) with a scalable architecture for national expansion.
- Support geo-fencing for localized pricing, regional promotions, and service availability adjustments.

## 4. Assets & Branding

- **Branding**: Orange, black, and white color scheme with bold, modern sans-serif fonts (e.g., Montserrat, Poppins).
- **Logo**: Stylized delivery van or rolling parcel icon (to be designed).
- **Images**: High-quality photos of drivers, delivery vans, and satisfied customers.
- **Videos**: Short promotional clips highlighting fast delivery, tracking, and eco-friendly options (to be produced).
- **Visuals**: Clean UI with expressive icons, real-life delivery footage, and a responsive design for all devices.
- **Theming**: The app ships a light and a dark theme, both driven by one token
  file. Components name roles (`bg-card`), never colours (`bg-gray-900`) — see
  [docs/theming.md](docs/theming.md) before adding UI.

## 5. Functional Requirements (MVP)

### Key Features

- **Booking System**: Instant quotes based on parcel weight, distance, and tier (Standard, Express, Business Solutions).
- **Real-Time Tracking**: GPS and live updates accessible to users, drivers, and admins.
- **Notification System**: SMS and email alerts for booking confirmation, status changes (picked up, in transit, delivered), and loyalty updates.
- **Multi-Role Access**: Tailored interfaces for users, drivers, and admins with secure authentication.
- **Payment Integration**: Secure gateway for online payments with support for multiple methods.
- **Loyalty & Referral Program**: Tracks points (e.g., 10th delivery free) and referral credits (e.g., £5 off for both parties).
- **Analytics Dashboard**: Monitors KPIs (on-time delivery %, failed drops, retention rate, monthly volume) with visual charts.
- **Instant Quote Calculator**: Dynamic pricing based on weight, distance, and service tier.
- **Multi-Tier Delivery**: Supports Standard (Same-Day/Next-Day), Express (1-2 hour), and Business Solutions (Scheduled).

### User (Parcel Senders) Panel

- **Responsibilities**: Book deliveries, get quotes, track parcels, manage orders, redeem rewards.
- **Access**: Public interface with registration/login, booking form, tracking dashboard, account settings.
- **Features**: Instant quote tool, real-time tracking, customizable SMS/email notifications, order history, loyalty point redemption.

### Driver Portal

- **Responsibilities**: Accept/reject deliveries, update status, navigate routes, provide proof of delivery.
- **Access**: Secure dashboard with ID-verified login.
- **Features**: Delivery list with real-time updates, navigation integration, in-app chat, photo/signature upload.
- **Onboarding & Profile**: Handled by the admin.

### Admin Panel

- **Responsibilities**: Oversee operations, manage users/drivers, approve applications, assign deliveries, analyze performance, handle disputes.
- **Access**: Elevated permission panel with secure authentication.
- **Features**:
  - Order management with manual overrides (reassign, cancel/refund).
  - User/driver management (approve/reject, deactivate).
  - Analytics dashboard with KPI tracking and CSV export.
  - Support tool for dispute resolution and issue tracking.
  - Financial reporting (monthly volume, revenue, average order value).
- **Driver Management**: Approve/reject applications, monitor performance, temporary deactivation.
- **Support & Dispute Resolution**: Manage failed drops and facilitate customer/driver communication.

## 6. Technical Considerations

- **Security**: OAuth2/JWT token-based authentication, SSL encryption, secure payment processing.
- **Scalability**: Cloud-based architecture (e.g., AWS) to support national growth, load balancing for peak times.
- **Performance**: Optimized for fast load times, responsive design for mobile/desktop.
- **APIs**: Integration with route optimization (e.g., Bringg, Onfleet) and e-commerce platforms (Shopify, Etsy, eBay).
- **Notifications**: SMS/email API integration (e.g., Twilio) with failover options.
