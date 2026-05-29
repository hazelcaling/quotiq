from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import random
from sqlalchemy import JSON

db = SQLAlchemy()


# ---------------------------
# Quote Number Generator
# ---------------------------
def generate_unique_quote_number():
    while True:
        date_part = datetime.now().strftime("%m%d%y")
        random_part = f"{random.randint(0, 999):03d}"
        quote_number = f"Q{date_part}{random_part}"

        existing = Quote.query.filter_by(quote_number=quote_number).first()
        if not existing:
            return quote_number


# ---------------------------
# Quote Model
# ---------------------------
class Quote(db.Model):
    __tablename__ = "quotes"

    id = db.Column(db.Integer, primary_key=True)

    quote_number = db.Column(
        db.String(20),
        unique=True,
        nullable=False,
        default=generate_unique_quote_number
    )

    date = db.Column(
        db.Date,
        nullable=False,
        default=datetime.utcnow
    )

    bid_date = db.Column(db.String(50), default="N/A")

    # multiple contacts
    contact = db.Column(JSON, default=list)

    project = db.Column(db.String(200))
    to_company = db.Column(db.String(100))
    attention = db.Column(db.String(100))
    location = db.Column(db.String(100))

    status = db.Column(db.String(30), default="Not Started")

    notes = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # ✅ RELATIONSHIP (IMPORTANT)
    line_items = db.relationship(
        "LineItem",
        backref="quote",
        cascade="all, delete-orphan",
        order_by="LineItem.sort_order"
    )


# ---------------------------
# Line Item Model
# ---------------------------
class LineItem(db.Model):
    __tablename__ = "line_items"

    id = db.Column(db.Integer, primary_key=True)

    # ✅ FK must match table name "quotes"
    quote_id = db.Column(
        db.Integer,
        db.ForeignKey("quotes.id"),
        nullable=False
    )

    notes_selected = db.relationship(
        "LineItemNote",
        backref="line_item",
        cascade="all, delete-orphan",
        order_by="LineItemNote.sort_order"
   )

    sort_order = db.Column(db.Integer, default=0)

    # Basic info
    tag = db.Column(db.String(100))
    vendor = db.Column(db.String(100))
    qty = db.Column(db.Integer, default=1)
    description = db.Column(db.Text)

    item = db.Column(db.String(100), nullable=True)
    type = db.Column(db.String(100), nullable=True)
    series = db.Column(db.String(100), nullable=True)
    model = db.Column(db.String(100), nullable=True)
    part_number = db.Column(db.String(100), nullable=True)

    # Pricing inputs
    list_price = db.Column(db.Numeric(10, 2), default=0)
    multiplier = db.Column(db.Numeric(10, 4), default=1)
    markup = db.Column(db.Numeric(10, 4), default=0)

    freight = db.Column(db.Numeric(10, 2), default=0)
    startup = db.Column(db.Numeric(10, 2), default=0)
    surcharge = db.Column(db.Numeric(10, 2), default=0)

    # ✅ ONLY FFA or FOB
    terms = db.Column(db.String(20), default="FOB")

    # Calculated
    net_cost = db.Column(db.Numeric(10, 2), default=0)
    sell_price = db.Column(db.Numeric(10, 2), default=0)
    total_price = db.Column(db.Numeric(10, 2), default=0)

    notes = db.Column(db.Text)

    included = db.Column(db.Boolean, default=False)

class NotesLibrary(db.Model):
    __tablename__ = "notes_library"

    id = db.Column(db.Integer, primary_key=True)

    item = db.Column(db.String(100))
    type = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(100), nullable=True)

    series = db.Column(db.String(100), nullable=True)

    model = db.Column(db.String(100), nullable=True)

    text = db.Column(db.Text)

    note_type = db.Column(db.String(50))
    # standard
    # additional
    # exception
    # internal

    default_selected = db.Column(db.Boolean, default=False)

    sort_order = db.Column(db.Integer, default=0)

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(200))

    tag = db.Column(db.String(200), nullable=True)

    vendor = db.Column(db.String(100))
    manufacturer = db.Column(db.String(100))

    category = db.Column(db.String(50))
    # boiler
    # pump
    # tank
    # heat exchanger

    type = db.Column(db.String(50), nullable=True)
    # condensing
    # end suction
    # storage tank

    series = db.Column(db.String(100), nullable=True)
    # Hi Delta
    # 4280

    model = db.Column(db.String(100), nullable=True)

    part_number = db.Column(
        db.String(100),
        unique=True,
        nullable=True
    )

    description = db.Column(db.Text)

    list_price = db.Column(
        db.Numeric(10, 2),
        default=0
    )

    surcharge = db.Column(
        db.Numeric(10, 4),
        default=0
    )

    multiplier = db.Column(
        db.Numeric(10, 4),
        default=1
    )

    net_cost = db.Column(
        db.Numeric(12, 2),
        default=0
    )

    notes = db.Column(db.Text)

    is_active = db.Column(
        db.Boolean,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

class LineItemNote(db.Model):
    __tablename__ = "line_item_notes"

    id = db.Column(db.Integer, primary_key=True)

    line_item_id = db.Column(
        db.Integer,
        db.ForeignKey("line_items.id"),
        nullable=False
    )

    note_library_id = db.Column(
        db.Integer,
        db.ForeignKey("notes_library.id"),
        nullable=True
    )

    category = db.Column(db.String(100), nullable=True)
    label = db.Column(db.String(200), nullable=True)
    text = db.Column(db.Text, nullable=False)

    is_custom = db.Column(db.Boolean, default=False)
    is_selected = db.Column(db.Boolean, default=True)

    sort_order = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )


class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(50), nullable=True)

    address1 = db.Column(db.String(200), nullable=True)
    address2 = db.Column(db.String(200), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    zipcode = db.Column(db.String(20), nullable=True)

    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    website = db.Column(db.String(200), nullable=True)
    account_number = db.Column(db.String(100), nullable=True)
    tax_id = db.Column(db.String(100), nullable=True)
    payment_terms = db.Column(db.String(100), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    contacts = db.relationship(
        "Contact",
        backref="company",
        cascade="all, delete-orphan"
    )


class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)

    company_id = db.Column(
        db.Integer,
        db.ForeignKey("companies.id"),
        nullable=False
    )

    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=True)

    role = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    tel = db.Column(db.String(50), nullable=True)
    mobile = db.Column(db.String(50), nullable=True)

    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )