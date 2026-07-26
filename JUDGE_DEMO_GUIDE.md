# KhedutConnect Final-Round Strategy — July 22, 2026

## What the 40/100 feedback means

The judge's question is not mainly about the interface. It tests whether the business can handle a real wholesale buyer whose requirement is larger than one farmer's stock. The final presentation must prove that KhedutConnect is an order-coordination platform, not only a product-listing website.

## The strongest answer

KhedutConnect now uses a parent-child fulfillment model:

1. The buyer submits one requirement.
2. The system matches product name, category, unit, maximum price, and available stock.
3. It reserves inventory and creates farmer-level allocations.
4. Each farmer accepts or rejects only their allocated share.
5. Rejected stock is restored and the missing quantity is offered to another farmer.
6. The buyer and admin track the complete requirement as one consolidated order.
7. Future payment flow: the buyer pays once into escrow; the platform settles each farmer after delivery confirmation.

## Final feature priorities

### Must work perfectly

- Multi-farmer split order and automatic reallocation — implemented.
- Atomic stock reservation and restoration — implemented.
- Buyer, farmer, and admin visibility — implemented.
- Demo data and repeatable demo steps — implemented.
- Mobile responsive flow and no startup errors.

### Build next before the final

1. Farmer verification badge: Aadhaar/KYC/FPO verification status and admin approval.
2. Quality evidence: crop grade, moisture percentage, harvest date, photos, and optional lab report.
3. Delivery plan: pickup date, vehicle/transport assignment, OTP proof of delivery.
4. Payment prototype: one buyer payment, allocation-wise farmer settlement, platform commission calculation.
5. Gujarati-first interface: Gujarati/English language toggle for the complete order flow.
6. Impact dashboard: farmer earnings increase, buyer savings, fulfilled quantity, delivery success rate.

Do not add many unfinished AI features. A working end-to-end procurement flow will score better than ten buttons that do not produce reliable results.

## Nine-day execution schedule

- **July 13–15:** Complete and test multi-farmer order flow on multiple accounts.
- **July 16–17:** Add quality, verification, delivery, and payment prototype screens.
- **July 18:** Mobile testing, error handling, empty states, and database backup.
- **July 19:** Prepare measurable impact figures and architecture diagram.
- **July 20:** Record backup demo video and prepare offline screenshots.
- **July 21:** Rehearse the pitch and judge questions at least five times.
- **July 22:** Use seeded demo data; keep a local backup and hotspot ready.

## Recommended live demo

1. Show three farmers listing Wheat: 180 kg, 170 kg, and 250 kg.
2. Login as buyer and request 500 kg Wheat.
3. Click Preview Split and explain why the allocations are safe.
4. Place the order and show the consolidated buyer card.
5. Login as Farmer 1 and accept 180 kg.
6. Login as Farmer 2 and reject 170 kg.
7. Show inventory restoration and replacement matching.
8. Login as admin and show allocation-level monitoring.
9. Finish with impact: the buyer gets one dependable supply contract, while smaller farmers participate in a larger order.

## Questions judges may ask

**What if farmers have different prices?**  
The order stores each allocation's price separately and calculates a weighted total. The buyer may set a maximum price per unit before matching.

**What if one farmer rejects?**  
The farmer's reserved stock is restored, the rejected allocation remains in the audit trail, and the missing quantity is matched to another eligible farmer.

**How do you prevent selling the same stock twice?**  
The backend reserves stock with a conditional database update that succeeds only when the required quantity is still available.

**Who is responsible for quality?**  
Each allocation will carry quality grade, evidence, and verification. The platform can hold payment until delivery and quality confirmation.

**How will payment work?**  
The buyer pays one consolidated amount to escrow. After OTP delivery confirmation, the system distributes allocation-wise payouts and deducts the platform commission.

**What is the revenue model?**  
A small transaction commission, logistics facilitation fee, premium buyer procurement tools, and optional verified-quality services.
