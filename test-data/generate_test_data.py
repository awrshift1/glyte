"""Generate test CSV datasets for Glyte analytics tool."""

import csv
import random
from datetime import datetime, timedelta

random.seed(42)

OUTPUT_DIR = "/Users/sk/Documents/Glyte/test-data"

# --- Reusable data pools (no external deps) ---

FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael",
    "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan",
    "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen", "Charles",
    "Lisa", "Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Margaret",
    "Mark", "Sandra", "Donald", "Ashley", "Steven", "Kimberly", "Paul",
    "Emily", "Andrew", "Donna", "Joshua", "Michelle", "Kenneth", "Carol",
    "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa", "Timothy",
    "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
    "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary",
    "Amy", "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna",
    "Stephen", "Brenda", "Larry", "Pamela", "Justin", "Emma", "Scott",
    "Nicole", "Brandon", "Helen", "Benjamin", "Samantha", "Samuel", "Katherine",
    "Raymond", "Christine", "Gregory", "Debra", "Frank", "Rachel", "Alexander",
    "Carolyn", "Patrick", "Janet", "Jack", "Catherine", "Dennis", "Maria",
    "Jerry", "Heather",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
    "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
    "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
    "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
    "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez",
    "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
    "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long",
    "Ross", "Foster", "Jimenez",
]

COMPANIES = [
    "Acme Corp", "TechVault", "DataStream", "CloudNine Solutions",
    "Pinnacle Group", "Quantum Systems", "Nexus Digital", "Apex Innovations",
    "Vortex Labs", "Silverline Analytics", "BlueSky Networks", "Ironclad Security",
    "Evergreen Software", "Catalyst Partners", "Horizon Media", "Fusion Dynamics",
    "CoreStack", "Brightpath AI", "Zenith Consulting", "Pulse Technologies",
    "Summit Financial", "RedOak Ventures", "ClearView Data", "Momentum Labs",
    "Stratos Cloud", "PixelForge", "SwiftScale", "NovaTech", "Granite Systems",
    "Cobalt Industries", "Ember Analytics", "Falcon Digital", "Lighthouse SaaS",
    "Vertex Solutions", "OmniFlow", "TerraFirma", "Prism Insights",
    "ArcLight", "Keystone Tech", "Ripple Commerce",
]

TITLES = [
    "CEO", "CTO", "CFO", "VP of Sales", "VP of Marketing",
    "Head of Growth", "Director of Operations", "Marketing Manager",
    "Sales Manager", "Account Executive", "Product Manager",
    "Head of Partnerships", "Business Development Manager", "COO",
    "Head of Finance", "Director of Engineering", "CMO",
    "Revenue Operations Manager", "Customer Success Manager",
    "Head of Analytics",
]

STATUSES = ["Lead", "Qualified", "Customer", "Churned"]
STATUS_WEIGHTS = [40, 30, 20, 10]

CHANNELS = ["Email", "LinkedIn", "Google Ads", "Facebook", "Referral"]

CAMPAIGN_ADJECTIVES = [
    "Spring", "Summer", "Autumn", "Winter", "Q1", "Q2", "Q3", "Q4",
    "Launch", "Growth", "Retarget", "Awareness", "Conversion", "Nurture",
    "Outbound", "Inbound", "Enterprise", "SMB", "Premium", "Scale",
]

CAMPAIGN_NOUNS = [
    "Blitz", "Push", "Wave", "Sprint", "Drive", "Surge", "Campaign",
    "Initiative", "Program", "Sequence", "Flow", "Series", "Funnel",
]

DEAL_STAGES = ["Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
DEAL_STAGE_WEIGHTS = [20, 25, 20, 25, 10]


def random_date(start, end):
    """Return a random date string between start and end."""
    delta = end - start
    random_days = random.randint(0, max(0, delta.days))
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")


def generate_email(first, last, company):
    """Generate a plausible email from name and company."""
    domain = company.lower().replace(" ", "").replace(".", "")[:12] + ".com"
    patterns = [
        f"{first.lower()}.{last.lower()}@{domain}",
        f"{first[0].lower()}{last.lower()}@{domain}",
        f"{first.lower()}@{domain}",
    ]
    return random.choice(patterns)


def generate_campaign_name(channel):
    """Generate a campaign name like 'Q2 Enterprise Blitz - Email'."""
    adj = random.choice(CAMPAIGN_ADJECTIVES)
    noun = random.choice(CAMPAIGN_NOUNS)
    return f"{adj} {noun} - {channel}"


# ============================================================
# 1. campaigns.csv - 50 rows (generate first, contacts reference it)
# ============================================================

campaigns = []
for cid in range(1, 51):
    channel = random.choice(CHANNELS)
    start = datetime(2025, 1, 1) + timedelta(days=random.randint(0, 300))
    end = start + timedelta(days=random.randint(14, 90))
    budget = round(random.uniform(2000, 50000), 2)
    spend = round(random.uniform(budget * 0.4, budget), 2)
    impressions = random.randint(5000, 500000)
    clicks = random.randint(int(impressions * 0.005), int(impressions * 0.08))
    conversions = random.randint(0, max(1, int(clicks * 0.15)))

    campaigns.append({
        "id": cid,
        "name": generate_campaign_name(channel),
        "channel": channel,
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "budget": budget,
        "spend": spend,
        "impressions": impressions,
        "clicks": clicks,
        "conversions": conversions,
    })

campaigns_path = f"{OUTPUT_DIR}/campaigns.csv"
with open(campaigns_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(campaigns[0].keys()))
    writer.writeheader()
    writer.writerows(campaigns)

print(f"campaigns.csv: {len(campaigns)} rows")

# ============================================================
# 2. contacts-basic.csv - 100 rows
# ============================================================

contacts = []
used_emails = set()

for cid in range(1, 101):
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    company = random.choice(COMPANIES)
    email = generate_email(first, last, company)

    # Ensure unique emails
    while email in used_emails:
        last = random.choice(LAST_NAMES)
        email = generate_email(first, last, company)
    used_emails.add(email)

    status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
    campaign_id = random.randint(1, 50)
    created_at = random_date(datetime(2025, 1, 1), datetime(2025, 12, 31))

    contacts.append({
        "id": cid,
        "first_name": first,
        "last_name": last,
        "email": email,
        "company": company,
        "title": random.choice(TITLES),
        "status": status,
        "campaign_id": campaign_id,
        "created_at": created_at,
    })

contacts_path = f"{OUTPUT_DIR}/contacts-basic.csv"
with open(contacts_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(contacts[0].keys()))
    writer.writeheader()
    writer.writerows(contacts)

print(f"contacts-basic.csv: {len(contacts)} rows")

# ============================================================
# 3. deals.csv - 30 rows (contact_id 1-30, source from matching campaign)
# ============================================================

deals = []
for did in range(1, 31):
    contact = contacts[did - 1]  # contact_id = did
    # Get the channel from the contact's campaign
    campaign = campaigns[contact["campaign_id"] - 1]
    source = campaign["channel"]

    stage = random.choices(DEAL_STAGES, weights=DEAL_STAGE_WEIGHTS, k=1)[0]
    amount = round(random.uniform(1000, 50000), 2)

    # Close date after contact created_at
    contact_created = datetime.strptime(contact["created_at"], "%Y-%m-%d")
    close_date = random_date(
        contact_created + timedelta(days=7),
        min(contact_created + timedelta(days=180), datetime(2025, 12, 31)),
    )

    deals.append({
        "id": did,
        "contact_id": did,
        "amount": amount,
        "stage": stage,
        "close_date": close_date,
        "source": source,
    })

deals_path = f"{OUTPUT_DIR}/deals.csv"
with open(deals_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(deals[0].keys()))
    writer.writeheader()
    writer.writerows(deals)

print(f"deals.csv: {len(deals)} rows")

# ============================================================
# 4. Verification - referential integrity
# ============================================================

print("\n--- Referential Integrity Check ---")

campaign_ids = {c["id"] for c in campaigns}
contact_campaign_ids = {c["campaign_id"] for c in contacts}
orphan_campaigns = contact_campaign_ids - campaign_ids
print(f"contacts.campaign_id -> campaigns.id: {'OK' if not orphan_campaigns else f'BROKEN - orphans: {orphan_campaigns}'}")

contact_ids = {c["id"] for c in contacts}
deal_contact_ids = {d["contact_id"] for d in deals}
orphan_contacts = deal_contact_ids - contact_ids
print(f"deals.contact_id -> contacts.id: {'OK' if not orphan_contacts else f'BROKEN - orphans: {orphan_contacts}'}")

print("\nDone.")
