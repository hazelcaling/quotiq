

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import "./App.css";
import hteLogo from "./assets/hte-logo.jpg";
import hteAddress from "./assets/hte-address.png";
import lastTwoPagesPdf from "./assets/last two page.pdf";
import LoadingSpinner from "./LoadingSpinner";

const API =
  import.meta.env.VITE_API_URL || 
  "http://localhost:5000" || "http://127.0.0.1:5000"
  ;

axios.defaults.withCredentials = true;


const emptyQuote = {
  quote_number: "",
  bid_date: "N/A",
  contact: [],
  project: "",
  to_company: "",
  attention: "",
  location: "",
  status: "Not Started",
  notes: "",
  showNoSpec: true,
  freight_terms: "FOB",
  freight_note: "",
};

const emptyLineItem = {
  tag: "",
  vendor: "",
  qty: 1,
  description: "",
  item: "",
  type: "",
  series: "",
  model: "",
  part_number: "",
  list_price: 0,
  multiplier: 1,
  markup: 0,
  freight: 0,
  startup: 0,
  surcharge: 0,
  terms: "FFA",
  notes: "",
  included: false,
};

const emptyProduct = {
  tag: "",
  name: "",
  vendor: "",
  manufacturer: "",
  category: "",
  type: "",
  series: "",
  model: "",
  part_number: "",
  description: "",
  list_price: 0,
  multiplier: 1,
  surcharge: 0,
  net_cost: 0,
  notes: "",
  is_active: true,
};

const emptyNote = {
  item: "",
  type: "",
  category: "",
  series: "",
  model: "",
  text: "",
  note_type: "standard",
  default_selected: false,
  sort_order: 0,
  is_active: true,
};

const emptyCompany = {
  name: "",
  type: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zipcode: "",
  notes: "",
  website: "",
  account_number: "",
  tax_id: "",
  payment_terms: "",
  is_active: true,
};

const emptyContact = {
  company_id: "",
  first_name: "",
  last_name: "",
  role: "",
  email: "",
  tel: "",
  mobile: "",
  notes: "",
  is_active: true,
};



function money(value) {
  const n = Number(value || 0);
  if (n === 0) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatContact(contact) {
  if (!contact) return "";
  if (Array.isArray(contact)) return contact.join(", ");
  try {
    const parsed = JSON.parse(contact);
    return Array.isArray(parsed) ? parsed.join(", ") : String(contact);
  } catch {
    return String(contact);
  }
}

function contactToArray(contact) {
  if (!contact) return [];

  let value = contact;

  while (typeof value === "string") {
    const cleaned = value.trim();

    try {
      value = JSON.parse(cleaned);
    } catch {
      return cleaned
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .replace(/["']/g, "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((x) => contactToArray(x))
      .filter(Boolean);
  }

  return [];
}

function quoteTotal(quote) {
  return (quote.line_items || []).reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  );
}

const formatMoney = money;

function getLineDescription(item) {
  const selectedNotes = (item.notes_selected || [])
    .filter((n) => n.is_selected)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((n) => `• ${n.text}`);
  return [item.description, ...selectedNotes].filter(Boolean).join("\n");
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [quotes, setQuotes] = useState([]);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [activeQuoteId, setActiveQuoteId] = useState(null);

  const [lineItemForm, setLineItemForm] = useState(emptyLineItem);
  const descriptionRef = useRef(null);
  const tagRef = useRef(null);

  const [editingLineItemId, setEditingLineItemId] = useState(null);
  const [draggedLineItem, setDraggedLineItem] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [notes, setNotes] = useState([]);

  const [lineProductResults, setLineProductResults] = useState([]);
  const [lineProductSearchMessage, setLineProductSearchMessage] = useState("");

  const [dashSearch, setDashSearch] = useState("");
  const [dashStatus, setDashStatus] = useState("");
  const [dashSort, setDashSort] = useState("id");
  const [dashDirection, setDashDirection] = useState("desc");
  const [dashSalesman, setDashSalesman] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const [companyResults, setCompanyResults] = useState([]);
const [companySearchMessage, setCompanySearchMessage] = useState("");
const [selectedCompanyId, setSelectedCompanyId] = useState(null);

const [contactResults, setContactResults] = useState([]);
const [contactSearchMessage, setContactSearchMessage] = useState("");

  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);

  const [noteForm, setNoteForm] = useState(emptyNote);
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [editingCompanyId, setEditingCompanyId] = useState(null);

  const [contactForm, setContactForm] = useState(emptyContact);
  const [editingContactId, setEditingContactId] = useState(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteLineItem, setNoteLineItem] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState([]);

  const [showNoSpec, setShowNoSpec] = useState(true);
  
const [noteModalSearch, setNoteModalSearch] = useState("");

const [projectResults, setProjectResults] = useState([]);
const [projectSearchMessage, setProjectSearchMessage] = useState("");

const [dashLineSearch, setDashLineSearch] = useState("");
const [dashCustomer, setDashCustomer] = useState("");
const [dashLocation, setDashLocation] = useState("");
const [dashQuoteDateFrom, setDashQuoteDateFrom] = useState("");
const [dashQuoteDateTo, setDashQuoteDateTo] = useState("");
const [dashBidDateFrom, setDashBidDateFrom] = useState("");
const [dashBidDateTo, setDashBidDateTo] = useState("");
const [copiedQuote, setCopiedQuote] = useState(null);
const [showCopiedRequired, setShowCopiedRequired] = useState(false);
const [draftCopiedLineItems, setDraftCopiedLineItems] = useState([]);
const [dashPage, setDashPage] = useState(1);
const [deletingQuoteId, setDeletingQuoteId] = useState(null);
const [dashboardMessage, setDashboardMessage] = useState("");
const [quoteBusy, setQuoteBusy] = useState(false);
const [quoteMessage, setQuoteMessage] = useState("");

const [lineItemBusy, setLineItemBusy] = useState(false);
const [lineItemMessage, setLineItemMessage] = useState("");
const [deletingLineItemId, setDeletingLineItemId] = useState(null);
const [locationResults, setLocationResults] = useState([]);
const [activeLookupField, setActiveLookupField] = useState(null);
const [locationSearchMessage, setLocationSearchMessage] = useState("");
const [currentUser, setCurrentUser] = useState(null);
const [loading, setLoading] = useState(false);
// Add this near line ~140 (after dashPage)
const [crudPage, setCrudPage] = useState(1);
const crudPageSize = 10;
const [loginForm, setLoginForm] = useState({
  email: "",
  password: "",
});
const [loginMessage, setLoginMessage] = useState("");
const dashPageSize = 10;

  const activeQuote = quotes.find((q) => q.id === activeQuoteId);
  const isCopyDraft = draftCopiedLineItems.length > 0 && !activeQuoteId;

  const isCopiedQuoteReadyToSave =
  !showCopiedRequired ||
  (
    String(quoteForm.to_company || "").trim() &&
    String(quoteForm.attention || "").trim() &&
    contactToArray(quoteForm.contact).length > 0
  );

  const calculatedPreview = useMemo(() => {
    const list = Number(lineItemForm.list_price || 0);
    const multiplier = Number(lineItemForm.multiplier || 1);
    const markup = Number(lineItemForm.markup || 0);
    const freight = Number(lineItemForm.freight || 0);
    const startup = Number(lineItemForm.startup || 0);
    const surcharge = Number(lineItemForm.surcharge || 0);
    const qty = Number(lineItemForm.qty || 1);
    const net = list * (1 + surcharge) * multiplier;
    const sell = Math.round(net * (1 + markup) + freight + startup);
    return { net, sell, total: sell * qty };
  }, [lineItemForm]);

  useEffect(() => {
    checkLogin();
  }, []);

  useEffect(() => {
  if (!currentUser) return;

  if (location.pathname === "/dashboard") {
    fetchQuotes();
  }

  if (location.pathname === "/") {
    fetchQuotes();
  }

  if (location.pathname === "/companies") {
    fetchCompanies();
  }

  if (location.pathname === "/contacts") {
    fetchContacts();
    fetchCompanies(); // needed for company dropdown in contacts
  }

  if (location.pathname === "/products") {
    fetchProducts();
  }

  if (location.pathname === "/notes") {
    fetchNotes();
  }
}, [currentUser, location.pathname]);

  async function fetchQuotes(params = {}) {
    const res = await axios.get(`${API}/quotes`, { params });
    setQuotes(res.data);
  }

  async function refreshActiveQuote(id = activeQuoteId) {
  if (!id) return;

  const res = await axios.get(`${API}/quotes/${id}`);

  setQuotes((prev) =>
    prev.map((q) => (q.id === id ? res.data : q))
  );
}


async function fetchDashboard() {
  setLoading(true);

  try {
    setDashPage(1);

    await fetchQuotes({
      search: dashSearch,
      line_search: dashLineSearch,
      status: dashStatus,
      customer: dashCustomer,
      location: dashLocation,
      salesman: dashSalesman,
      quote_date_from: dashQuoteDateFrom,
      quote_date_to: dashQuoteDateTo,
      bid_date_from: dashBidDateFrom,
      bid_date_to: dashBidDateTo,
      sort_by: dashSort,
      direction: dashDirection,
    });
  } finally {
    setLoading(false);
  }
}

async function clearDashboardFilters() {
  setDashSearch("");
  setDashLineSearch("");
  setDashStatus("");
  setDashCustomer("");
  setDashLocation("");
  setDashSalesman("");
  setDashQuoteDateFrom("");
  setDashQuoteDateTo("");
  setDashBidDateFrom("");
  setDashBidDateTo("");
  setDashSort("id");
  setDashDirection("desc");
  setDashPage(1);

  await fetchQuotes({
    search: "",
    line_search: "",
    status: "",
    customer: "",
    location: "",
    salesman: "",
    quote_date_from: "",
    quote_date_to: "",
    bid_date_from: "",
    bid_date_to: "",
    sort_by: "id",
    direction: "desc",
  });
}

  async function fetchCompanies(search = "") {
    const res = await axios.get(`${API}/companies`, { params: { search } });
    setCompanies(res.data);
  }

  async function fetchContacts(search = "") {
    const res = await axios.get(`${API}/contacts`, { params: { search } });
    setContacts(res.data);
  }

  async function searchQuoteCompanies(term) {
  setQuoteForm((prev) => ({
    ...prev,
    to_company: term,
    attention: "",
  }));

  setSelectedCompanyId(null);
  setContactResults([]);
  setContactSearchMessage("");

  if (!term || term.length < 2) {
    setCompanyResults([]);
    setCompanySearchMessage("");
    return;
  }

  const res = await axios.get(`${API}/companies`, {
    params: { search: term },
  });

  setCompanyResults(res.data);

  if (res.data.length === 0) {
    setCompanySearchMessage("No company found yet. You can still type manually.");
  } else {
    setCompanySearchMessage("");
  }
}

function selectQuoteCompany(company) {
  setQuoteForm((prev) => ({
    ...prev,
    to_company: company.name,
    attention: "",
  }));

  setSelectedCompanyId(company.id);
  setCompanyResults([]);
  setCompanySearchMessage("");
}

async function searchQuoteContacts(term) {
  setQuoteForm((prev) => ({
    ...prev,
    attention: term,
  }));

  if (!selectedCompanyId) {
    setContactResults([]);
    setContactSearchMessage("Select a company first to search contacts.");
    return;
  }

  if (!term || term.length < 1) {
    setContactResults([]);
    setContactSearchMessage("");
    return;
  }

  const res = await axios.get(`${API}/contacts`, {
    params: {
      company_id: selectedCompanyId,
      search: term,
    },
  });

  setContactResults(res.data);

  if (res.data.length === 0) {
    setContactSearchMessage("No contact found for this company. You can still type manually.");
  } else {
    setContactSearchMessage("");
  }
}

async function searchQuoteProjects(term) {
  setQuoteForm((prev) => ({
    ...prev,
    project: term,
  }));

  if (!term || term.length < 2) {
    setProjectResults([]);
    setProjectSearchMessage("");
    return;
  }

  const matches = quotes
    .filter((q) =>
      String(q.project || "").toLowerCase().includes(term.toLowerCase())
    )
    .map((q) => q.project)
    .filter(Boolean);

  const uniqueProjects = [...new Set(matches)];

  setProjectResults(uniqueProjects);

  if (uniqueProjects.length === 0) {
    setProjectSearchMessage("No existing project found. You can still type manually.");
  } else {
    setProjectSearchMessage("");
  }
}

function uniqueProductValues(field, term) {
  if (!term || term.length < 1) return [];

  const seen = new Set();

  return products
    .map((p) => String(p[field] || "").trim())
    .filter(Boolean)
    .filter((value) =>
      value.toLowerCase().includes(term.toLowerCase())
    )
    .filter((value) => {
      const key = value.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function uniqueCompanyValues(field, term) {
  if (!term || term.length < 1) return [];

  const seen = new Set();

  return companies
    .map((c) => String(c[field] || "").trim())
    .filter(Boolean)
    .filter((value) =>
      value.toLowerCase().includes(term.toLowerCase())
    )
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function uniqueNoteValues(field, term) {
  if (!term || term.length < 1) return [];

  const seen = new Set();

  return notes
    .map((n) => String(n[field] || "").trim())
    .filter(Boolean)
    .filter((value) =>
      value.toLowerCase().includes(term.toLowerCase())
    )
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function selectQuoteProject(project) {
  setQuoteForm((prev) => ({
    ...prev,
    project,
  }));

  setProjectResults([]);
  setProjectSearchMessage("");
}

async function addQuoteCompany() {
  const name = String(quoteForm.to_company || "").trim();

  if (!name) {
    alert("Type a company name first.");
    return;
  }

  const res = await axios.post(`${API}/companies`, {
    name,
    type: "contractor",
    is_active: true,
  });

  const company = res.data;

  setQuoteForm((prev) => ({
    ...prev,
    to_company: company.name,
    attention: "",
  }));

  setSelectedCompanyId(company.id);
  setCompanyResults([]);
  setCompanySearchMessage("");
  await fetchCompanies();
}

async function addQuoteContact() {
  if (!selectedCompanyId) {
    alert("Select or add a company first.");
    return;
  }

  const fullName = String(quoteForm.attention || "").trim();

  if (!fullName) {
    alert("Type a contact name first.");
    return;
  }

  const parts = fullName.split(" ");
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  const res = await axios.post(`${API}/contacts`, {
    company_id: selectedCompanyId,
    first_name: firstName,
    last_name: lastName,
    is_active: true,
  });

  const contact = res.data;
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

  setQuoteForm((prev) => ({
    ...prev,
    attention: name,
  }));

  setContactResults([]);
  setContactSearchMessage("");
  await fetchContacts();
}

function selectQuoteContact(contact) {
  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

  setQuoteForm((prev) => ({
    ...prev,
    attention: fullName,
  }));

  setContactResults([]);
  setContactSearchMessage("");
}

  async function fetchProducts(search = "") {
    const res = await axios.get(`${API}/products`, { params: { search } });
    setProducts(res.data);
  }

  async function searchLineProducts(term) {
  setLineItemForm((prev) => ({
    ...prev,
    item: term,
  }));

  if (!term || term.length < 2) {
    setLineProductResults([]);
    setLineProductSearchMessage("");
    return;
  }

  const res = await axios.get(`${API}/products`, {
    params: { search: term },
  });

  setLineProductResults(res.data);

  if (res.data.length === 0) {
    setLineProductSearchMessage("No product found yet. You can still type manually.");
  } else {
    setLineProductSearchMessage("");
  }
}

function selectLineProduct(p) {
  setLineItemForm((prev) => ({
    ...prev,
    item: p.category || "",
    type: p.type || "",
    series: p.series || "",
    model: p.model || "",
    part_number: p.part_number || "",
    vendor: p.vendor || "",
    description: p.description || "",
    list_price: p.list_price || 0,
    multiplier: p.multiplier || 1,
    surcharge: p.surcharge || 0,
    tag: p.tag || prev.tag,
  }));

  setLineProductResults([]);
  setLineProductSearchMessage("");
  if (p.notes && String(p.notes).trim()) {
  alert(`Product Notes:\n\n${p.notes}`);
}
}

  async function fetchNotes(search = "") {
    const res = await axios.get(`${API}/notes-library`, { params: { search } });
    setNotes(res.data);
  }

  function updateForm(setter) {
    return (e) => {
      const { name, value, type, checked } = e.target;
      setter((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    };
  }

  function stripStyleMarkers(text) {
    let s = String(text || "");
    let prev = null;
    while (s !== prev) {
      prev = s;
      s = s
        .replace(/^\s*!!([\s\S]*?)!!\s*$/g, "$1")
        .replace(/^\*\*([\s\S]*?)\*\*$/g, "$1")
        .replace(/^\/\/([\s\S]*?)\/\/$/g, "$1")
        .replace(/^\[hl\]([\s\S]*?)\[\/hl\]$/g, "$1")
        .replace(/^\[(red|blue|green)\]([\s\S]*?)\[\/\1\]$/g, "$2");
    }
    return s
      .replace(/!!/g, "")
      .replace(/\*\*/g, "")
      .replace(/\/\//g, "")
      .replace(/\[hl\]|\[\/hl\]/g, "")
      .replace(/\[\/?(red|blue|green)\]/g, "")
      .trim();
  }

  function applyFieldStyle(field, style) {
    const el = field === "tag" ? tagRef.current : descriptionRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = (field === "tag" ? lineItemForm.tag : lineItemForm.description) || "";
    if (start === end) {
      alert("Highlight the text first, then click a style.");
      return;
    }
    const inner = stripStyleMarkers(value.slice(start, end));
    let wrapped = inner;
    if (style === "clear") {
      wrapped = inner;
    } else if (style === "header") {
      wrapped = `!!${inner}!!`;
    } else if (style === "bold") {
      wrapped = `**${inner}**`;
    } else if (style === "italic") {
      wrapped = `//${inner}//`;
    } else if (style === "highlight") {
      wrapped = `[hl]${inner}[/hl]`;
    } else if (style === "red" || style === "blue" || style === "green") {
      wrapped = `[${style}]${inner}[/${style}]`;
    } else {
      return;
    }
    const next = value.slice(0, start) + wrapped + value.slice(end);
    setLineItemForm((prev) => ({ ...prev, [field]: next }));
    requestAnimationFrame(() => {
      el.focus();
      const innerStart = start + (wrapped.length - inner.length) / 2;
      // Put caret after the styled text so the next click does not wrap markers.
      el.setSelectionRange(start + wrapped.length, start + wrapped.length);
    });
  }

  function handleQuoteContactInput(e) {
    const value = e.target.value;
    const arr = value.split(",").map((x) => x.trim()).filter(Boolean);
    setQuoteForm((prev) => ({ ...prev, contact: arr }));
  }

async function saveQuote(e) {
  e.preventDefault();

  if (!isCopiedQuoteReadyToSave) return;

  setQuoteBusy(true);
  setQuoteMessage(editingQuoteId ? "Updating quote..." : "Saving new quote...");

    const freightTermsValue =
    quoteForm.freight_terms === "CUSTOM" ||
    (quoteForm.freight_terms !== "FOB" && quoteForm.freight_terms !== "FFA")
      ? String(quoteForm.freight_note || "").trim()
      : quoteForm.freight_terms || "FOB";

  const quoteNumber = String(quoteForm.quote_number || "").trim();
  if (!quoteNumber) {
    setQuoteBusy(false);
    setQuoteMessage("Enter a quote number before saving.");
    setTimeout(() => setQuoteMessage(""), 5000);
    return;
  }

  const payload = {
    ...quoteForm,
    quote_number: quoteNumber,
    bid_date: quoteForm.bid_date || "N/A",
    freight_terms: freightTermsValue,
  };


  try {
    if (editingQuoteId) {
      const res = await axios.put(`${API}/quotes/${editingQuoteId}`, payload);

      await axios.post(`${API}/quotes/${editingQuoteId}/unlock`);

      setActiveQuoteId(res.data.id);
      setEditingQuoteId(null);
      setQuoteMessage("Quote updated successfully.");
    } else {
      const res = await axios.post(`${API}/quotes`, payload);
      const newQuoteId = res.data.id;

      for (const item of draftCopiedLineItems) {
        await axios.post(`${API}/quotes/${newQuoteId}/line-items`, {
          tag: item.tag || "",
          vendor: item.vendor || "",
          qty: item.qty || 1,
          description: item.description || "",
          item: item.item || "",
          type: item.type || "",
          series: item.series || "",
          model: item.model || "",
          part_number: item.part_number || "",
          list_price: item.list_price || 0,
          multiplier: item.multiplier || 1,
          markup: item.markup || 0,
          freight: item.freight || 0,
          startup: item.startup || 0,
          surcharge: item.surcharge || 0,
          terms: item.terms || "FOB",
          notes: item.notes || "",
          included: item.included || false,
        });
      }

      setActiveQuoteId(newQuoteId);
      setDraftCopiedLineItems([]);
      setCopiedQuote(null);
      setShowCopiedRequired(false);
      setQuoteMessage("Quote saved successfully.");
    }

    setQuoteForm(emptyQuote);
    await fetchQuotes();
    setTimeout(() => setQuoteMessage(""), 2500);
  } catch (err) {
    console.error(err);
    const status = err.response?.status;
    const apiErr = err.response?.data?.error || err.response?.data?.message;
    let message = "Unable to save quote. Please try again.";
    if (status === 409 || /already exist/i.test(String(apiErr || ""))) {
      message = apiErr || `Quote # ${quoteNumber} already exists. Enter a different quote number.`;
    } else if (status === 400 && apiErr) {
      message = apiErr;
    } else if (apiErr) {
      message = apiErr;
    }
    setQuoteMessage(message);
    setQuoteBusy(false);
    setTimeout(() => setQuoteMessage(""), 6000);
    return;
  } finally {
    setQuoteBusy(false);
  }
}


async function editQuote(q) {
  setLoading(true);
  try {
    if (editingQuoteId && editingQuoteId !== q.id) {
      await axios.post(`${API}/quotes/${editingQuoteId}/unlock`);
    }

    const res = await axios.post(`${API}/quotes/${q.id}/lock`);
    const lockedQuote = res.data;

    setEditingQuoteId(lockedQuote.id);
    setActiveQuoteId(lockedQuote.id);

    setQuoteForm({
      quote_number: lockedQuote.quote_number || "",
      bid_date: lockedQuote.bid_date || "N/A",
      contact: contactToArray(lockedQuote.contact),
      project: lockedQuote.project || "",
      to_company: lockedQuote.to_company || "",
      attention: lockedQuote.attention || "",
      location: lockedQuote.location || "",
      freight_terms:
        lockedQuote.freight_terms === "FOB" || lockedQuote.freight_terms === "FFA"
          ? lockedQuote.freight_terms
          : "CUSTOM",
      freight_note:
        lockedQuote.freight_terms === "FOB" || lockedQuote.freight_terms === "FFA"
          ? ""
          : lockedQuote.freight_terms || "",
      status: lockedQuote.status || "Not Started",
      notes: lockedQuote.notes || "",
      date: lockedQuote.date || "",
    });

    await fetchQuotes();
    navigate("/");
  } catch (err) {
    alert(
      err.response?.data?.error ||
        "This quote is currently being edited by another user."
    );
  } finally {
    setLoading(false);
  }
}

  async function clearQuoteForm() {
  if (editingQuoteId) {
    try {
      await axios.post(`${API}/quotes/${editingQuoteId}/unlock`);
    } catch (err) {
      console.error(err);
    }
  }
    
  setEditingQuoteId(null);
  setActiveQuoteId(null);
  setQuoteForm({
    ...emptyQuote,
    date: new Date().toISOString().split("T")[0],
  });

  setCompanyResults([]);
  setCompanySearchMessage("");
  setSelectedCompanyId(null);
  setContactResults([]);
  setContactSearchMessage("");
  setProjectResults([]);
  setProjectSearchMessage("");

  setLineItemForm(emptyLineItem);
  setEditingLineItemId(null);
}



  async function deleteQuote(id) {
  if (!confirm("Delete this quote?")) return;

  setDeletingQuoteId(id);
  setDashboardMessage("Deleting quote...");

  try {
    await axios.delete(`${API}/quotes/${id}`);

    if (activeQuoteId === id) {
      setActiveQuoteId(null);
    }

    await fetchQuotes();

    setDashboardMessage("Quote deleted successfully.");
  } catch (err) {
    console.error(err);
    setDashboardMessage("Unable to delete quote. Please try again.");
  } finally {
    setDeletingQuoteId(null);

    setTimeout(() => {
      setDashboardMessage("");
    }, 2500);
  }
}

  async function autofillFromProduct(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return;
    const res = await axios.get(`${API}/products/lookup`, { params: { term: searchTerm } });
    const p = res.data?.[0];
    if (!p) return;

    setLineItemForm((prev) => ({
      ...prev,
      item: p.category || prev.item,
      type: p.type || prev.type,
      series: p.series || prev.series,
      model: p.model || prev.model,
      part_number: p.part_number || prev.part_number,
      vendor: p.vendor || prev.vendor,
      description: p.description || prev.description,
      list_price: p.list_price || 0,
      multiplier: p.multiplier || 1,
      surcharge: p.surcharge || 0,
    }));
  }


  async function saveLineItem(e) {
  e.preventDefault();

  if (!activeQuoteId) return;

  setLineItemBusy(true);
  setLineItemMessage(editingLineItemId ? "Updating line item..." : "Adding line item...");

  try {
    const payload = { ...lineItemForm };

    if (editingLineItemId) {
      await axios.put(`${API}/line-items/${editingLineItemId}`, payload);
      setEditingLineItemId(null);
      setLineItemMessage("Line item updated successfully.");
    } else {
      await axios.post(`${API}/quotes/${activeQuoteId}/line-items`, payload);
      setLineItemMessage("Line item added successfully.");
    }

    setLineItemForm(emptyLineItem);
    await refreshActiveQuote();
  } catch (err) {
    console.error(err);
    setLineItemMessage("Unable to save line item. Please try again.");
  } finally {
    setLineItemBusy(false);
    setTimeout(() => setLineItemMessage(""), 2500);
  }
}

  function editLineItem(item) {
    setEditingLineItemId(item.id);
    setLineItemForm({ ...emptyLineItem, ...item });
  }

async function deleteLineItem(id) {
  if (!confirm("Delete this line item?")) return;

  setDeletingLineItemId(id);
  setLineItemMessage("Deleting line item...");

  try {
    await axios.delete(`${API}/line-items/${id}`);
    await refreshActiveQuote();
    setLineItemMessage("Line item deleted successfully.");
  } catch (err) {
    console.error(err);
    setLineItemMessage("Unable to delete line item. Please try again.");
  } finally {
    setDeletingLineItemId(null);
    setTimeout(() => setLineItemMessage(""), 2500);
  }
}

  async function dropLineItem(targetItemId) {
    if (!draggedLineItem || !activeQuote) return;
    if (draggedLineItem === targetItemId) return;

    const items = [...(activeQuote.line_items || [])];
    const from = items.findIndex((x) => x.id === draggedLineItem);
    const to = items.findIndex((x) => x.id === targetItemId);
    if (from < 0 || to < 0) return;

    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);

    await axios.put(`${API}/quotes/${activeQuote.id}/line-items/reorder`, {
      item_ids: items.map((x) => x.id),
    });
    setDraggedLineItem(null);
    await refreshActiveQuote();
  }

  function copyQuote(q) {
  setCopiedQuote(q);
  alert(`Copied ${q.quote_number}. Go to Quote Builder and click Paste Copied Quote.`);
}

function pasteCopiedQuote() {
  if (!copiedQuote) return;

  setShowCopiedRequired(true);
  setEditingQuoteId(null);
  setActiveQuoteId(null);

  setQuoteForm({
    ...emptyQuote,
    date: new Date().toISOString().split("T")[0],
    bid_date: copiedQuote.bid_date || "N/A",
    project: copiedQuote.project || "",
    location: copiedQuote.location || "",
    status: "Not Started",
    notes: copiedQuote.notes || "",
    to_company: "",
    attention: "",
    contact: [],
  });

  setDraftCopiedLineItems(copiedQuote.line_items || []);
}

  async function openNotesModal(item) {
  setNoteLineItem(item);
  setNoteModalSearch("");

  const clean = (value) =>
    String(value || "")
      .replace(/^\+/, "")
      .trim();

  const terms = [
    clean(item.type),
    clean(item.item),
    clean(item.series),
    clean(item.model),
  ].filter(Boolean);

  let libraryNotes = [];

  for (const term of terms) {
    const res = await axios.get(`${API}/notes-library`, {
      params: { search: term },
    });

    libraryNotes = [...libraryNotes, ...(res.data || [])];
  }

  // remove duplicates
  libraryNotes = libraryNotes.filter(
    (note, index, arr) => index === arr.findIndex((x) => x.id === note.id)
  );

  // keep only notes that match this line item
libraryNotes = libraryNotes.filter((note) => {
  const categoryMatch =
    note.category &&
    item.item &&
    note.category.trim().toLowerCase() ===
      item.item.trim().toLowerCase();

  const seriesMatch =
    note.series &&
    item.series &&
    note.series.trim().toLowerCase() ===
      item.series.trim().toLowerCase();

  const modelMatch =
    note.model &&
    item.model &&
    note.model.trim().toLowerCase() ===
      item.model.trim().toLowerCase();

  return categoryMatch || seriesMatch || modelMatch;
});

  const selectedNotes = item.notes_selected || [];
  const merged = [];

  libraryNotes.forEach((n) => {
    const existing = selectedNotes.find((x) => x.note_library_id === n.id);

    merged.push({
      note_library_id: n.id,
      category: n.category || "",
      label: n.label || "",
      item: n.item || "",
      type: n.type || "",
      series: n.series || "",
      model: n.model || "",
      text: existing?.text || n.text || "",
      note_type: n.note_type || "standard",
      is_custom: false,
      is_selected: existing
        ? existing.is_selected
        : (n.note_type || "standard") === "standard",
      sort_order: existing?.sort_order || n.sort_order || 0,
    });
  });

  selectedNotes
    .filter(
      (x) =>
        !x.note_library_id ||
        !merged.some((m) => m.note_library_id === x.note_library_id)
    )
    .forEach((x) => {
      merged.push({
        ...x,
        category: x.category || "",
        label: x.label || "",
        item: x.item || item.item || "",
        type: x.type || item.type || "",
        series: x.series || item.series || "",
        model: x.model || item.model || "",
        text: x.text || "",
        note_type: x.note_type || "standard",
        is_custom: x.is_custom ?? true,
        is_selected: x.is_selected ?? true,
        sort_order: x.sort_order || 0,
      });
    });

  setNoteDrafts(merged);
  setNoteModalOpen(true);
}

  async function saveLineItemNotes() {
    await axios.put(`${API}/line-items/${noteLineItem.id}/notes`, {
      notes: noteDrafts
        .filter((n) => n.is_selected || n.is_custom)
        .map((n, index) => ({ ...n, sort_order: index + 1 })),
    });
    setNoteModalOpen(false);
    setNoteLineItem(null);
    setNoteDrafts([]);
    await refreshActiveQuote();
  }

  function getSelectedNoteText() {
  return noteDrafts
    .filter((n) => n.is_selected && String(n.text || "").trim())
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((n) => `- ${String(n.text || "").trim().replace(/^[-•]\s*/, "")}`)
    .join("\n");
}

async function addNotesToDescription() {
  if (!noteLineItem) return;

  const notesText = getSelectedNoteText();

  if (!notesText) {
    alert("Please select at least one note.");
    return;
  }

  const currentDescription = String(noteLineItem.description || "").trim();

  const updatedDescription = currentDescription
    ? `${currentDescription}\n\n${notesText}`
    : notesText;

  await axios.put(`${API}/line-items/${noteLineItem.id}`, {
    ...noteLineItem,
    description: updatedDescription,
  });

  setNoteModalOpen(false);
  setNoteLineItem(null);
  setNoteDrafts([]);
  await refreshActiveQuote();
}

async function addNotesAsSeparateLineItem() {
  if (!activeQuoteId || !noteLineItem) return;

  const notesText = getSelectedNoteText();

  if (!notesText) {
    alert("Please select at least one note.");
    return;
  }

  const payload = {
    ...emptyLineItem,

    tag: noteLineItem.tag || "",
    item: "Notes",
    type: "",
    series: noteLineItem.series || "",
    model: noteLineItem.model || "",
    part_number: "",
    vendor: "",

    qty: 0,
    description: notesText,

    list_price: 0,
    multiplier: 1,
    markup: 0,
    freight: 0,
    startup: 0,
    surcharge: 0,
    net_cost: 0,
    sell_price: 0,
    total_price: 0,

    terms: noteLineItem.terms || "FFA",
    included: false,
  };

  await axios.post(`${API}/quotes/${activeQuoteId}/line-items`, payload);

  setNoteModalOpen(false);
  setNoteLineItem(null);
  setNoteDrafts([]);
  await refreshActiveQuote();
}

  function addCustomNote() {
    setNoteDrafts((prev) => [
      ...prev,
      {
        note_library_id: null,
        category: "",
        label: "",
        text: "",
        note_type: "additional",
        is_custom: true,
        is_selected: true,
        sort_order: prev.length + 1,
      },
    ]);
  }

async function searchQuoteLocations(term) {
  setQuoteForm((prev) => ({
    ...prev,
    location: term,
  }));

  if (!term || term.length < 2) {
    setLocationResults([]);
    return;
  }

  const res = await axios.get(`${API}/locations`, {
    params: { search: term },
  });

  setLocationResults(res.data);
}

function selectQuoteLocation(location) {
  setQuoteForm((prev) => ({
    ...prev,
    location,
  }));

  setLocationResults([]);
  setLocationSearchMessage("");
}

  async function saveCrud(e, endpoint, form, editingId, reset, refresh, setEditing) {
    e.preventDefault();
    if (editingId) await axios.put(`${API}/${endpoint}/${editingId}`, form);
    else await axios.post(`${API}/${endpoint}`, form);
    reset();
    setEditing(null);
    await refresh();
  }

  async function deleteCrud(endpoint, id, refresh) {
    if (!confirm("Delete this record?")) return;
    await axios.delete(`${API}/${endpoint}/${id}`);
    await refresh();
  }

  async function checkLogin() {
  try {
    const res = await axios.get(`${API}/auth/me`);
    setCurrentUser(res.data.user);
  } catch {
    setCurrentUser(null);
  }
}

async function login(e) {
  e.preventDefault();

  try {
    const res = await axios.post(`${API}/auth/login`, loginForm);
    setCurrentUser(res.data);
    setLoginMessage("");
  } catch {
    setLoginMessage("Invalid email or password.");
  }
}

async function logout() {
  try {
    if (editingQuoteId) {
      await axios.post(
        `${API}/quotes/${editingQuoteId}/unlock`
      );
    }

    await axios.post(`${API}/auth/logout`);

    setCurrentUser(null);
    setEditingQuoteId(null);
    setActiveQuoteId(null);

    setLoginForm({
      email: "",
      password: "",
    });
  } catch (err) {
    console.error(err);
  }
}

if (!currentUser) {
  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={login}>
        <h3>Login</h3>

        <input
          type="email"
          placeholder="Email"
          value={loginForm.email}
          onChange={(e) =>
            setLoginForm((prev) => ({
              ...prev,
              email: e.target.value,
            }))
          }
        />

        <input
          type="password"
          placeholder="Password"
          value={loginForm.password}
          onChange={(e) =>
            setLoginForm((prev) => ({
              ...prev,
              password: e.target.value,
            }))
          }
        />

        <button type="submit" className="btn primary">
          Login
        </button>

        {loginMessage && (
          <div className="required-save-message">
            {loginMessage}
          </div>
        )}
      </form>
    </div>
  );
}

if (loading) {
  return <LoadingSpinner text="Loading..." />;
}


const printQuotePdf = async (quote, mode = "preview") => {
  const doc = new jsPDF("p", "pt", "letter");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 36;
  const marginRight = 36;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Strong bottom safety zone – stay above "Page X of Y"
  const bottomSafe = 72;

  // ========== HEADER (Logo + Address) ==========
  const pageHeader = () => {
    doc.addImage(hteLogo, "JPEG", marginLeft, 20, 150, 55);
    doc.addImage(hteAddress, "PNG", pageWidth - marginRight - 230, 38, 230, 55);
  };

  // ========== COLUMN HEADER ==========
  const drawColumnHeader = (startY) => {
    doc.setFillColor(230, 230, 230);
    doc.rect(
      marginLeft - 10,
      startY,
      pageWidth - marginRight + 10 - (marginLeft - 10),
      14,
      "F"
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const tableTop = startY + 11;

    const colX = [
      marginLeft - 5,
      marginLeft + 98,
      marginLeft + 130,
      pageWidth - marginRight - 92,
      pageWidth - marginRight - 20,
    ];

    doc.text("TAG", colX[0] + 8, tableTop);
    doc.text("QTY", colX[1], tableTop, { align: "center" });
    doc.text("DESCRIPTION", colX[2] + 130, tableTop, { align: "center" });
    doc.text("NET EACH", colX[3], tableTop, { align: "center" });
    doc.text("EXT. TOTAL", colX[4], tableTop, { align: "center" });

    // Extra space after the column header before content starts
    return startY + 34;
  };

  const addNewPage = () => {
    doc.addPage();
    pageHeader();
    y = drawColumnHeader(95);
    doc.setFontSize(8.5);
    return y;
  };

  // ========== PAGE 1 ==========
  pageHeader();

  const titleY = 110;
  const topLineY = titleY - 18;
  const bottomLineY = titleY + 8;

  doc.setDrawColor(20, 80, 60);
  doc.setLineWidth(2);

  const tableLeft = marginLeft;
  const tableRight = pageWidth - marginRight;

  doc.line(tableLeft, topLineY, tableRight, topLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUOTATION", pageWidth / 2, titleY, { align: "center" });

  doc.line(tableLeft, bottomLineY, tableRight, bottomLineY);

  let y = bottomLineY + 25;

  autoTable(doc, {
    startY: y,
    margin: { left: marginLeft + 5, right: marginRight + 5 },
    theme: "grid",
    body: [
      [
        "DATE:",
        quote.date
          ? new Date(`${quote.date}T00:00:00`).toLocaleDateString("en-US")
          : "",
        "BID DATE:",
        quote.bid_date || "",
      ],
      ["QUOTE #:", quote.quote_number || "", "TO:", quote.to_company || ""],
      ["CONTACT:", formatContact(quote.contact), "ATTENTION:", quote.attention || ""],
      ["PROJECT:", quote.project || "", "LOCATION:", quote.location || ""],
    ],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.6,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold", fillColor: [235, 235, 235] },
      1: { cellWidth: 180 },
      2: { cellWidth: 90, fontStyle: "bold", fillColor: [235, 235, 235] },
      3: { cellWidth: 180 },
    },
  });

  y = doc.lastAutoTable.finalY + 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);

  const paragraphGap = 7;
  const lineHeight = 8.3;

  const addParagraph = (text, options = {}) => {
    doc.setFont("helvetica", options.style || "normal");

    if (options.color) {
      doc.setTextColor(...options.color);
    } else {
      doc.setTextColor(0, 0, 0);
    }

    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, marginLeft, y);
    y += lines.length * lineHeight + paragraphGap;

    doc.setTextColor(0, 0, 0);
  };

  // Intro paragraphs (kept exactly as original)
  addParagraph(
    "We are pleased to propose the following equipment for your consideration and subject to the engineer’s approval. Our proposal is limited only to that portion of the specifications concerning the equipment we have proposed per the sections and related paragraphs cited in our proposal. On all Heat Transfer Equipment Company’s quotations, where project plans and/or specifications have not been provided, we reserve the right to re-quote once the missing plans are provided to us."
  );

  addParagraph(
    "Pricing is based upon the purchase of ALL equipment, per each manufacturer, on this quotation. If all equipment will not be ordered in full, price is subject to change. It is to not be assumed that any equipment or components, not explicitly written into this quote, even if they are within our scope, are included in the pricing of this quotation. Please discuss with your sales associate if any item is in question.",
    { style: "bold" }
  );

  addParagraph(
    "This quotation is in accordance with the Terms & Conditions listed at the end of this document – H.T.E. does not agree to accept other Terms & Conditions unless noted within this quotation.",
    { style: "bold" }
  );

  addParagraph("Tariff Disclaimer:", {
    style: "bolditalic",
    color: [200, 0, 0],
  });

  addParagraph(
    "At Heat Transfer Equipment, we strive to provide accurate and competitive pricing based on the tariff rates, duties, government-imposed charges, and trade regulations in effect at the time this quote is issued. However, we recognize that global trade conditions and regulatory decisions can change unexpectedly and are outside of any of our control.",
    { style: "bolditalic", color: [200, 0, 0] }
  );

  addParagraph(
    "If new tariffs, duties, taxes, or similar charges are introduced, or if existing ones are modified by any government or regulatory authority (“Tariff Changes”), and these changes result in an increase to the cost of goods, we reserve the right to adjust the pricing of the affected items to reflect those changes.",
    { style: "bolditalic", color: [200, 0, 0] }
  );

  addParagraph(
    "Any tariff-related cost increases that take effect after the quote date will be communicated to you in advance of issuing the final invoice. We will always do our best to provide transparency and timely updates to help you make informed purchasing decisions.",
    { style: "bolditalic", color: [200, 0, 0] }
  );

  addParagraph(
    "If you have any questions or would like to better understand how potential tariff changes may impact your order, please don’t hesitate to contact your Heat Transfer Equipment sales representative. We truly appreciate your business and your understanding as we navigate these evolving conditions together.",
    { style: "bolditalic", color: [200, 0, 0] }
  );

  // green line after tariff
  y += 3;
  doc.setDrawColor(20, 80, 60);
  doc.setLineWidth(2);
  doc.line(marginLeft - 10, y, pageWidth - marginRight + 10, y);
  y += 16;

  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  if (quote.showNoSpec !== false) {
    doc.text("NO SPECIFICATIONS PROVIDED", pageWidth / 2, y, {
      align: "center",
    });
    y += 10;
  }

  // ==================== MANUAL TABLE ====================
  y += 1;

  // First page column header
  y = drawColumnHeader(y);

  doc.setFontSize(8.5);
  const tableLineHeight = 9.8;
  const descMaxWidth = 300;
  const colX = [
    marginLeft - 5,
    marginLeft + 98,
    marginLeft + 130,
    pageWidth - marginRight - 92,
    pageWidth - marginRight - 20,
  ];
  const descLeft = colX[2] + 5;
  const maxW = descMaxWidth - 30;
  const contentBottom = () => pageHeight - bottomSafe;

  const tokenizeStyled = (input) => {
    const text = String(input || "");
    const tokens = [];
    let i = 0;
    const defaults = tokenizeStyled._defaults || {};
    const pushPlain = (chunk) => {
      if (chunk) tokens.push({
        text: chunk,
        bold: !!defaults.bold,
        italic: !!defaults.italic,
        color: defaults.color || null,
        highlight: false,
      });
    };
    while (i < text.length) {
      const rest = text.slice(i);
      const rules = [
        { open: "**", close: "**", style: { bold: true } },
        { open: "//", close: "//", style: { italic: true } },
        { open: "[hl]", close: "[/hl]", style: { highlight: true } },
        { open: "[red]", close: "[/red]", style: { color: [200, 0, 0] } },
        { open: "[blue]", close: "[/blue]", style: { color: [29, 78, 216] } },
        { open: "[green]", close: "[/green]", style: { color: [21, 128, 61] } },
      ];
      let matched = false;
      for (const rule of rules) {
        if (rest.startsWith(rule.open)) {
          const end = text.indexOf(rule.close, i + rule.open.length);
          if (end !== -1) {
            tokens.push({
              text: text.slice(i + rule.open.length, end),
              bold: !!rule.style.bold || !!defaults.bold,
              italic: !!rule.style.italic || !!defaults.italic,
              color: rule.style.color || defaults.color || null,
              highlight: !!rule.style.highlight,
            });
            i = end + rule.close.length;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
      const nextIdx = Math.min(
        ...rules.map((rule) => {
          const n = text.indexOf(rule.open, i + 1);
          return n === -1 ? text.length : n;
        })
      );
      pushPlain(text.slice(i, nextIdx));
      i = nextIdx;
    }
    return tokens.filter((tok) => tok.text);
  };

  const applySpanFont = (span) => {
    const style = span.italic && span.bold ? "bolditalic" : span.italic ? "italic" : span.bold ? "bold" : "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(span.size || 8.5);
    if (span.color) doc.setTextColor(...span.color);
    else doc.setTextColor(0, 0, 0);
  };

  const drawStyledText = (input, startX, width, extra = {}) => {
    tokenizeStyled._defaults = {
      bold: !!extra.defaultBold,
      italic: !!extra.defaultItalic,
      color: extra.defaultColor || null,
    };
    const tokens = tokenizeStyled(input);
    tokenizeStyled._defaults = {};
    if (!tokens.length) return;
    let cursorX = startX;
    let lineMax = startX + width;
    const baseX = extra.baseX ?? descLeft;
    const baseWidth = extra.baseWidth ?? maxW;

    const pieces = [];
    tokens.forEach((tok) => {
      const parts = tok.text.split(/(\s+)/);
      parts.forEach((part) => {
        if (part) pieces.push({ ...tok, text: part });
      });
    });

    pieces.forEach((piece) => {
      applySpanFont(piece);
      let w = doc.getTextWidth(piece.text);
      if (cursorX > baseX && cursorX + w > lineMax && piece.text.trim()) {
        if (y + tableLineHeight + 2 > contentBottom()) {
          addNewPage();
        } else {
          y += tableLineHeight;
        }
        cursorX = baseX;
        lineMax = baseX + baseWidth;
      }
      if (y + 2 > contentBottom()) {
        addNewPage();
        cursorX = baseX;
        lineMax = baseX + baseWidth;
      }
      if (piece.highlight && piece.text.trim()) {
        doc.setFillColor(255, 255, 0);
        doc.rect(cursorX - 1, y - 7.5, w + 2, 10, "F");
      }
      applySpanFont(piece);
      doc.text(piece.text, cursorX, y);
      cursorX += w;
    });
    y += tableLineHeight;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };


  const ensureSpace = (needed = tableLineHeight + 2) => {
    if (y + needed > contentBottom()) {
      y = addNewPage();
      doc.setFontSize(8.5);
    }
  };

  const wrapWords = (text, firstX, firstWidth, nextX, nextWidth) => {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    let width = firstWidth;
    let x = firstX;
    const push = () => {
      if (!current) return;
      lines.push({ text: current, x });
      current = "";
      width = nextWidth;
      x = nextX;
    };
    words.forEach((word) => {
      const test = current ? current + " " + word : word;
      doc.setFontSize(8.5);
      if (doc.getTextWidth(test) <= width) {
        current = test;
      } else {
        push();
        current = word;
      }
    });
    if (current) lines.push({ text: current, x });
    return lines;
  };


  const findPhraseSplit = (text) => {
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== "." && ch !== ",") continue;
      const prev = i > 0 ? s[i - 1] : "";
      const next = i + 1 < s.length ? s[i + 1] : "";
      if (/\d/.test(prev) && /\d/.test(next)) continue;
      return i;
    }
    return -1;
  };

  const drawFlowText = (fullText, firstBold) => {
    const trimmed = String(fullText || "").replace(/\s+/g, " ").trim();
    if (!trimmed) return;

    let boldPart = "";
    let restPart = trimmed;
    if (firstBold) {
      let splitIndex = findPhraseSplit(trimmed);
      if (splitIndex === -1) {
        boldPart = trimmed;
        restPart = "";
      } else {
        boldPart = trimmed.substring(0, splitIndex + 1).trim();
        restPart = trimmed.substring(splitIndex + 1).trim();
      }
    }

    if (boldPart) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      const boldWords = boldPart.split(/\s+/).filter(Boolean);
      let line = "";
      boldWords.forEach((word) => {
        const test = line ? line + " " + word : word;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        if (doc.getTextWidth(test) <= maxW) {
          line = test;
        } else {
          if (line) {
            ensureSpace();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.text(line, descLeft, y);
            y += tableLineHeight;
          }
          line = word;
        }
      });
      ensureSpace();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      if (line) doc.text(line, descLeft, y);
      if (!restPart) {
        y += tableLineHeight;
        return;
      }
      const used = line ? doc.getTextWidth(line) + doc.getTextWidth(" ") : 0;
      const firstX = descLeft + used;
      const firstAvail = Math.max(18, maxW - used);
      drawStyledText(restPart, firstX, firstAvail, { baseX: descLeft, baseWidth: maxW });
      return;
    }

    ensureSpace();
    drawStyledText(trimmed, descLeft, maxW, { baseX: descLeft, baseWidth: maxW });
  };

  const measureFlow = (fullText, firstBold) => {
    const trimmed = String(fullText || "").replace(/\s+/g, " ").trim();
    if (!trimmed) return 0;
    doc.setFontSize(8.5);
    if (!firstBold) {
      return doc.splitTextToSize(trimmed, maxW).length * tableLineHeight;
    }
    let splitIndex = findPhraseSplit(trimmed);
    const boldPart = splitIndex === -1 ? trimmed : trimmed.substring(0, splitIndex + 1).trim();
    const restPart = splitIndex === -1 ? "" : trimmed.substring(splitIndex + 1).trim();
    doc.setFont("helvetica", "bold");
    if (!restPart) return (doc.splitTextToSize(boldPart, maxW).length || 1) * tableLineHeight;
    const boldW = doc.getTextWidth(boldPart);
    if (boldW >= maxW) {
      doc.setFont("helvetica", "normal");
      return (
        doc.splitTextToSize(boldPart, maxW).length +
        doc.splitTextToSize(restPart, maxW).length
      ) * tableLineHeight;
    }
    const gap = doc.getTextWidth(" ");
    doc.setFont("helvetica", "normal");
    const lines = wrapWords(restPart, descLeft + boldW + gap, Math.max(24, maxW - boldW - gap), descLeft, maxW);
    return Math.max(1, lines.length) * tableLineHeight;
  };

  const parseBlocks = (description) => {
    const fullDesc = (description || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const rawLines = fullDesc ? fullDesc.split("\n") : [];
    const blocks = [];
    let flow = [];
    const flushFlow = () => {
      if (!flow.length) return;
      blocks.push({ type: "flow", text: flow.join(" ").replace(/\s+/g, " ").trim() });
      flow = [];
    };
    rawLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushFlow();
        return;
      }
      const sectionMatch = trimmed.match(/^!!(.+)!!$/);
      if (sectionMatch) {
        flushFlow();
        blocks.push({ type: "section", text: sectionMatch[1].trim() });
        return;
      }
      if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
        flushFlow();
        let bulletContent = trimmed.replace(/^[•-]\s*/, "").trim();
        const red = bulletContent.includes("##");
        if (red) bulletContent = bulletContent.replace(/##/g, "").trim();
        blocks.push({ type: "bullet", text: bulletContent, red });
        return;
      }
      if (/^NOTES:\s*/i.test(trimmed)) {
        flushFlow();
        const after = trimmed.replace(/^NOTES:\s*/i, "").trim();
        blocks.push({ type: "notes" });
        if (after) {
          if (after.startsWith("•") || after.startsWith("-")) {
            let bulletContent = after.replace(/^[•-]\s*/, "").trim();
            const red = bulletContent.includes("##");
            if (red) bulletContent = bulletContent.replace(/##/g, "").trim();
            blocks.push({ type: "bullet", text: bulletContent, red });
          } else {
            blocks.push({ type: "flow", text: after });
          }
        }
        return;
      }
      flow.push(trimmed);
    });
    flushFlow();
    return blocks;
  };

  const measureBlocks = (blocks) => {
    let h = 0;
    blocks.forEach((block, i) => {
      if (block.type === "section") h += tableLineHeight + 4;
      else if (block.type === "notes") h += tableLineHeight;
      else if (block.type === "bullet") {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        h += doc.splitTextToSize("• " + block.text, maxW).length * tableLineHeight;
      } else if (block.type === "flow") {
        const firstBold = !blocks.slice(0, i).some((b) => b.type === "flow");
        h += measureFlow(block.text, firstBold);
      }
    });
    return h;
  };

  // ==================== TABLE BODY ====================
  (quote.line_items || []).forEach((item) => {
    const qty = Number(item.qty) > 0 ? item.qty.toString() : "";
    const netPrice = item.included ? "Included" : formatMoney(item.sell_price);
    const extPrice = item.included ? "Included" : formatMoney(item.total_price);
    const blocks = parseBlocks(item.description);
    const tagText = item.tag || "";
    const tagMaxW = 86;
    const tagSourceLines = String(tagText).replace(/\r\n/g, "\n").split("\n");
    const stripTagMarks = (s) =>
      String(s)
        .replace(/\*\*/g, "")
        .replace(/\/\//g, "")
        .replace(/\[hl\]|\[\/hl\]/g, "")
        .replace(/\[\/?(red|blue|green)\]/g, "");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    let tagHeight = 0;
    tagSourceLines.forEach((line) => {
      const plain = stripTagMarks(line) || " ";
      tagHeight += Math.max(1, doc.splitTextToSize(plain, tagMaxW).length) * tableLineHeight;
    });
    if (!tagSourceLines.length) tagHeight = tableLineHeight;
    const descHeight = measureBlocks(blocks);
    const itemHeight = Math.max(tagHeight, descHeight) + 20;
    const usablePage = pageHeight - 118 - bottomSafe;

    // Only start a new page if there is no room for even two lines.
    // Long items fill the rest of this page, then continue on the next.
    if (y + tableLineHeight * 2 > contentBottom()) {
      y = addNewPage();
      doc.setFontSize(8.5);
    }

    const startY = y;
    const itemStartPage = doc.internal.getCurrentPageInfo().pageNumber;

    const tagX = colX[0] + 8;
    const savedY = y;
    y = startY + 1;
    const AUTO_BLUE = [50, 90, 165];
    const SPEC_SIZE = 6.5;
    let markedTag = String(tagText).replace(
      /\(([\s\S]*?Specification[\s\S]*?)\)/gi,
      "[spec]($1)[/spec]"
    );
    markedTag = markedTag.replace(
      /(VE Option|Basis of Design)/gi,
      "[autoBlue]$1[/autoBlue]"
    );
    markedTag = markedTag.replace(/\(Required\)/gi, "[req](Required)[/req]");
    const markedLines = markedTag.replace(/\r\n/g, "\n").split("\n");
    let inSpec = false;
    let inBlue = false;
    let inReq = false;
    markedLines.forEach((sourceLine) => {
      const linePlain = stripTagMarks(
        String(sourceLine)
          .replace(/\[spec\]|\[\/spec\]|\[autoBlue\]|\[\/autoBlue\]|\[req\]|\[\/req\]/g, "")
      ).trim();
      const autoHl = /^[A-Za-z]+-\d/.test(linePlain);
      const pieces = String(sourceLine).split(/(\[spec\]|\[\/spec\]|\[autoBlue\]|\[\/autoBlue\]|\[req\]|\[\/req\])/);
      const tokens = [];
      pieces.forEach((part) => {
        if (part === "[spec]") { inSpec = true; return; }
        if (part === "[/spec]") { inSpec = false; return; }
        if (part === "[autoBlue]") { inBlue = true; return; }
        if (part === "[/autoBlue]") { inBlue = false; return; }
        if (part === "[req]") { inReq = true; return; }
        if (part === "[/req]") { inReq = false; return; }
        if (!part) return;
        tokenizeStyled._defaults = {
          bold: !inSpec,
          italic: inSpec,
          color: inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : null,
        };
        const rawTokens = tokenizeStyled(part);
        tokenizeStyled._defaults = {};
        rawTokens.forEach((tok) => {
          tokens.push({
            ...tok,
            bold: inSpec ? false : true,
            italic: inSpec ? true : !!tok.italic,
            color: inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : tok.color,
            highlight: inReq ? false : !!(tok.highlight || autoHl),
            size: inSpec ? SPEC_SIZE : 8.5,
          });
        });
        if (!rawTokens.length) {
          tokens.push({
            text: part,
            bold: !inSpec,
            italic: inSpec,
            color: inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : null,
            highlight: inReq ? false : autoHl,
            size: inSpec ? SPEC_SIZE : 8.5,
          });
        }
      });
      let cursorX = tagX;
      tokens.forEach((tok) => {
        const bits = tok.text.split(/(\s+)/);
        bits.forEach((bit) => {
          if (!bit) return;
          applySpanFont({ ...tok, text: bit });
          if (tok.color) doc.setTextColor(...tok.color);
          const w = doc.getTextWidth(bit);
          if (cursorX > tagX && cursorX + w > tagX + tagMaxW && bit.trim()) {
            y += tableLineHeight;
            cursorX = tagX;
          }
          if (tok.highlight && bit.trim()) {
            doc.setFillColor(255, 255, 0);
            doc.rect(cursorX - 1, y - 7.5, w + 2, 10, "F");
            applySpanFont({ ...tok, text: bit });
            if (tok.color) doc.setTextColor(...tok.color);
          }
          doc.text(bit, cursorX, y);
          cursorX += w;
        });
      });
      y += tableLineHeight;
    });
    const tagEndY = y;
    y = savedY;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(qty, colX[1], startY + 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(netPrice, colX[3], startY + 1, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(extPrice, colX[4], startY + 1, { align: "center" });

    let usedFlow = false;
    blocks.forEach((block) => {
      if (block.type === "section") {
        ensureSpace(tableLineHeight + 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(37, 99, 235);
        doc.text(block.text, colX[2] + 150, y, { align: "center" });
        y += tableLineHeight + 4;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8.5);
        return;
      }
      if (block.type === "notes") {
        ensureSpace();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);
        doc.text("NOTES:", descLeft, y);
        y += tableLineHeight;
        return;
      }
      if (block.type === "bullet") {
        const bulletIndent = colX[2] + 12;
        const wrapIndent = colX[2] + 17;
        ensureSpace();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(block.red ? 200 : 0, 0, 0);
        doc.text("• ", bulletIndent, y);
        const prefixW = doc.getTextWidth("• ");
        drawStyledText(block.text, bulletIndent + prefixW, maxW - prefixW, {
          baseX: wrapIndent,
          baseWidth: maxW - 8,
          defaultItalic: true,
          defaultColor: block.red ? [200, 0, 0] : null,
        });
        return;
      }
      if (block.type === "flow") {
        const firstBold = !usedFlow;
        usedFlow = true;
        drawFlowText(block.text, firstBold);
      }
    });

    const samePageAsStart =
      doc.internal.getCurrentPageInfo().pageNumber === itemStartPage;
    if (samePageAsStart) {
      y = Math.max(y, tagEndY || startY, startY + tagHeight) + 16;
    } else {
      y += 16;
    }
  });

  // ==================== PRICING NOTES + TOTAL ====================
  if (y > pageHeight - bottomSafe - 45) {
    y = addNewPage();
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(marginLeft - 10, y, pageWidth - marginRight + 10, y);

  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  const terms = String(quote.freight_terms || "FOB").trim();
  const termsText =
    terms === "FOB"
      ? "FOB ORIGIN"
      : terms === "FFA"
        ? "FFA ORIGIN"
        : terms;

  const priceNote1 = "PRICING DOES NOT INCLUDE SALES TAX";
  const priceNote2 =
    terms === "FOB" || terms === "FFA"
      ? `ALL EQUIPMENT HAS BEEN PRICED: ${termsText}`
      : termsText;

  const drawHighlightedText = (text, yPos) => {
    const textWidth = doc.getTextWidth(text);
    const padding = 4;
    const x = pageWidth - marginRight - textWidth;

    doc.setFillColor(255, 255, 0);
    doc.rect(x - padding, yPos - 6, textWidth + padding * 2, 11, "F");

    doc.setTextColor(0, 0, 0);
    doc.text(text, pageWidth - marginRight, yPos, { align: "right" });
  };

  drawHighlightedText(priceNote1, y);
  y += 14;
  drawHighlightedText(priceNote2, y);
  y += 16;

  // TOTAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL: ${formatMoney(quoteTotal(quote))}`, pageWidth - marginRight, y, {
    align: "right",
  });

  // ========== MERGE WITH LAST TWO PAGES ==========
  const quotePdfBytes = doc.output("arraybuffer");
  const quotePdf = await PDFDocument.load(quotePdfBytes);

  const lastPagesBytes = await fetch(lastTwoPagesPdf).then((res) =>
    res.arrayBuffer()
  );
  const lastPagesPdf = await PDFDocument.load(lastPagesBytes);

  const copiedPages = await quotePdf.copyPages(
    lastPagesPdf,
    lastPagesPdf.getPageIndices()
  );

  copiedPages.forEach((page) => {
    quotePdf.addPage(page);
  });

// ========== PAGE NUMBERS (bottom right, bold current page) ==========
const totalPages = quotePdf.getPageCount();
const pages = quotePdf.getPages();
const font = await quotePdf.embedFont(StandardFonts.Helvetica);
const fontBold = await quotePdf.embedFont(StandardFonts.HelveticaBold);

pages.forEach((page, index) => {
  const { width } = page.getSize();
  const pageNum = index + 1;
  const textY = 26;
  const size = 10;

  const prefix = "Page ";
  const number = String(pageNum);
  const suffix = ` of ${totalPages}`;

  const prefixWidth = font.widthOfTextAtSize(prefix, size);
  const numberWidth = fontBold.widthOfTextAtSize(number, size);
  const suffixWidth = font.widthOfTextAtSize(suffix, size);

  // Start from the right edge with a small margin
  let x = width - 25 - (prefixWidth + numberWidth + suffixWidth);

  // "Page "
  page.drawText(prefix, {
    x,
    y: textY,
    size,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });
  x += prefixWidth;

  // Bold page number
  page.drawText(number, {
    x,
    y: textY,
    size,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  x += numberWidth;

  // " of X"
  page.drawText(suffix, {
    x,
    y: textY,
    size,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });
});



  // ========== SAVE / PREVIEW ==========
  const finalPdfBytes = await quotePdf.save();
  const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  if (mode === "download") {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quote.quote_number || "quote"}.pdf`;
    a.click();
  } else {
    window.open(url, "_blank");
  }
};

const previewQuotePdf = async (quote) => {
  await printQuotePdf(quote, "preview");
};

const downloadQuotePdf = async (quote) => {
  await printQuotePdf(quote, "download");
};


  function Dashboard() {
    const pagedQuotes = quotes.slice(
  (dashPage - 1) * dashPageSize,
  dashPage * dashPageSize
);

const totalDashPages = Math.ceil(quotes.length / dashPageSize) || 1;

// === NEW: Dashboard Statistics ===
  const totalQuotes = quotes.length;
  const totalValue = quotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);

  const wonQuotes = quotes.filter(q => q.status === "Won");
  const lostQuotes = quotes.filter(q => q.status === "Lost");
  const pendingQuotes = quotes.filter(q => 
    ["In Progress", "Bid Submitted", "Bid Submitted - to Sales", "Not Started", "Pending Instruction from Sales"].includes(q.status)
  );

  const wonValue = wonQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const lostValue = lostQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const pendingValue = pendingQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);

  const submittedQuotes = totalQuotes;
  const submittedValue = totalValue;

  const winRate = submittedQuotes > 0 ? Math.round((wonQuotes.length / submittedQuotes) * 100) : 0;

  // Monthly / Weekly stats (approximate)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());

  const createdThisMonth = quotes.filter(q => {
    const created = new Date(q.created_at || q.date);
    return created >= thisMonthStart;
  });

  const createdThisWeek = quotes.filter(q => {
    const created = new Date(q.created_at || q.date);
    return created >= thisWeekStart;
  });

  async function downloadExport(type) {
  // type = "quotes" or "line-items"
  const params = new URLSearchParams({
    search: dashSearch || "",
    line_search: dashLineSearch || "",
    status: dashStatus || "",
    customer: dashCustomer || "",
    location: dashLocation || "",
    salesman: dashSalesman || "",
    quote_date_from: dashQuoteDateFrom || "",
    quote_date_to: dashQuoteDateTo || "",
    bid_date_from: dashBidDateFrom || "",
    bid_date_to: dashBidDateTo || "",
  });

  try {
    const res = await axios.get(`${API}/quotes/export${type === "line-items" ? "-line-items" : ""}`, {
      params,
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      type === "line-items"
        ? `line_items_export.xlsx`
        : `quotes_export.xlsx`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Failed to download export. Please try again.");
  }
}

    return (
      <section className="screen">

        {/* ==================== NEW SUMMARY SECTION ==================== */}
      <div className="dashboard-summary">
        <h2>📊 Quote Performance Overview</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">📝 Quotes Submitted</div>
            <div className="stat-value">{submittedQuotes.toLocaleString()} <span className="percent">(100%)</span></div>
            <div className="stat-money">${(submittedValue / 1_000_000).toFixed(1)}M</div>
          </div>

          <div className="stat-card success">
            <div className="stat-title">✅ Won</div>
            <div className="stat-value">{wonQuotes.length} <span className="percent">({Math.round((wonQuotes.length / submittedQuotes) * 100) || 0}%)</span></div>
            <div className="stat-money">${(wonValue / 1_000_000).toFixed(1)}M</div>
          </div>

          <div className="stat-card danger">
            <div className="stat-title">❌ Lost</div>
            <div className="stat-value">{lostQuotes.length} <span className="percent">({Math.round((lostQuotes.length / submittedQuotes) * 100) || 0}%)</span></div>
            <div className="stat-money">${(lostValue / 1_000_000).toFixed(1)}M</div>
          </div>

          <div className="stat-card warning">
            <div className="stat-title">⏳ Pending / Follow-Up</div>
            <div className="stat-value">{pendingQuotes.length} <span className="percent">({Math.round((pendingQuotes.length / submittedQuotes) * 100) || 0}%)</span></div>
            <div className="stat-money">${(pendingValue / 1_000_000).toFixed(1)}M</div>
          </div>
        </div>

        <div className="stats-row">
          <div className="activity-card">
            <h3>📊 Quote Activity</h3>
            <p><strong>Total Quotes:</strong> {totalQuotes.toLocaleString()} | ${(totalValue / 1_000_000).toFixed(1)}M</p>
            <p><strong>Created This Month:</strong> {createdThisMonth.length} | ${((createdThisMonth.reduce((sum, q) => sum + (Number(q.total) || 0), 0)) / 1000).toFixed(0)}K</p>
            <p><strong>Created This Week:</strong> {createdThisWeek.length} | ${((createdThisWeek.reduce((sum, q) => sum + (Number(q.total) || 0), 0)) / 1000).toFixed(0)}K</p>
          </div>

        </div>
      </div>

      <div className="toolbar dashboard-toolbar">
  <input
    placeholder="Search Quote # / Job / Attn"
    value={dashSearch}
    onChange={(e) => setDashSearch(e.target.value)}
  />

  <input
    placeholder="Search Line Item Description"
    value={dashLineSearch}
    onChange={(e) => setDashLineSearch(e.target.value)}
  />

  <select value={dashStatus} onChange={(e) => setDashStatus(e.target.value)}>
    <option value="">All Status</option>
    <option>Not Started</option>
    <option>In Progress</option>
    <option>Bid Submitted</option>
        <option>Bid Submitted - to Sales</option>
    <option>Not Bidding</option>
    <option>Won</option>
    <option>Lost</option>
  </select>

  <select
  value={dashSalesman}
  onChange={(e) => setDashSalesman(e.target.value)}
>
  <option value="">All Outside Sales</option>
  <option value="Mike Llorence">Mike Llorence</option>
  <option value="Phil Haas">Phil Haas</option>
  <option value="Luke Hanzlik">Luke Hanzlik</option>
  <option value="Alex White">Alex White</option>
  <option value="Mark Labitad">Mark Labitad</option>
  <option value="Rhiannon Canas">Rhiannon Canas</option>
  <option value="Megan McCabe">Megan McCabe</option>
  <option value="Hazel Caling">Hazel Caling</option>
</select>

  <input
    placeholder="Customer"
    value={dashCustomer}
    onChange={(e) => setDashCustomer(e.target.value)}
  />

  <input
    placeholder="Location"
    value={dashLocation}
    onChange={(e) => setDashLocation(e.target.value)}
  />

  <label>
    Quote Date From
    <input
      type="date"
      value={dashQuoteDateFrom}
      onChange={(e) => setDashQuoteDateFrom(e.target.value)}
    />
  </label>

  <label>
    Quote Date To
    <input
      type="date"
      value={dashQuoteDateTo}
      onChange={(e) => setDashQuoteDateTo(e.target.value)}
    />
  </label>

  <label>
    Bid Due From
    <input
      type="date"
      value={dashBidDateFrom}
      onChange={(e) => setDashBidDateFrom(e.target.value)}
    />
  </label>

  <label>
    Bid Due To
    <input
      type="date"
      value={dashBidDateTo}
      onChange={(e) => setDashBidDateTo(e.target.value)}
    />
  </label>

  <select value={dashSort} onChange={(e) => setDashSort(e.target.value)}>
    <option value="id">Created On</option>
    <option value="date">Quote Date</option>
    <option value="bid_date">Bid Due Date</option>
    <option value="status">Status</option>
    <option value="project">Job</option>
    <option value="to_company">Customer</option>
    <option value="attention">Attn</option>
    <option value="location">Location</option>
  </select>

  <select value={dashDirection} onChange={(e) => setDashDirection(e.target.value)}>
    <option value="desc">Desc</option>
    <option value="asc">Asc</option>
  </select>

  <div className="button-row">
    <button
      className="btn primary"
      type="button"
      onClick={fetchDashboard}
    >
      Search
    </button>

    <button
      type="button"
      className="btn secondary"
      onClick={clearDashboardFilters}
    >
      Clear
    </button>
 <div className="button-row">
     <button
  className="btn download"
  type="button"
  onClick={() => downloadExport("quotes")}
>
  Download Quotes
</button>

<button
  className="btn download"
  type="button"
  onClick={() => downloadExport("line-items")}
>
  Download Line Items
</button>
 </div>
  </div>
</div>
{dashboardMessage && (
  <div className="dashboard-message">
    {dashboardMessage}
  </div>
)}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Outside Sales</th>
                <th>Quote #</th>
                <th>Bid Due Date</th>
                <th>Created On</th>
                <th>Status</th>
                <th>Job</th>
                <th>Customer</th>
                
                <th>Total</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedQuotes.map((q) => (
                <tr key={q.id}>
                  <td>{formatContact(q.contact)}</td>
                  <td>{q.quote_number}</td>
                  <td>{q.bid_date}</td>
                  <td>{q.created_at || q.date}</td>
                  <td><span className="pill">{q.status}</span></td>
                  <td>{q.project}</td>
                  <td>{q.to_company}</td>
                  
                  <td>{money(q.total)}</td>
                  <td>{q.location}</td>
                  <td>
                    <button
  className="btn secondary"
  type="button"
  onClick={() => copyQuote(q)}
>
  Copy
</button>
<button
  className="btn preview"
  type="button"
  onClick={() => previewQuotePdf(q)}
>
  PDF
</button>
                    <button
  className="btn secondary"
  disabled={
    q.locked_by &&
    q.locked_by !== currentUser?.name
  }
  title={
    q.locked_by &&
    q.locked_by !== currentUser?.name
      ? `${q.locked_by} is currently editing this quote`
      : "Edit Quote"
  }
  onClick={() => editQuote(q)}
>
  {q.locked_by &&
   q.locked_by !== currentUser?.name
    ? `Locked`
    : "Edit"}
</button>
{q.locked_by &&
 q.locked_by !== currentUser?.name && (
  <span className="quote-lock-indicator">
    🔒 {q.locked_by} is here
  </span>
)}
                   
                    <button
  className="btn delete"
  disabled={deletingQuoteId === q.id}
  onClick={() => deleteQuote(q.id)}
>
  {deletingQuoteId === q.id ? "Deleting..." : "Delete"}
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
  <button
    className="btn secondary"
    disabled={dashPage === 1}
    onClick={() => setDashPage((p) => Math.max(1, p - 1))}
  >
    Previous
  </button>

  <span>
    Page {dashPage} of {totalDashPages}
  </span>

  <button
    className="btn secondary"
    disabled={dashPage === totalDashPages}
    onClick={() => setDashPage((p) => Math.min(totalDashPages, p + 1))}
  >
    Next
  </button>
</div>

        </div>
      </section>
    );
  }

  function Builder() {
    return (
  <section className="screen">
    <div className="two-panel">
      <form className="card form-grid" onSubmit={saveQuote}>
        <h3>{editingQuoteId ? "Edit Quote" : "Quote Form"}</h3>

<label>
  Project
  <div className="lookup-field">
    <input
      name="project"
      placeholder="Job / Project"
      value={quoteForm.project}
      onChange={(e) => searchQuoteProjects(e.target.value)}
    />

    {projectResults.length > 0 && (
      <div className="lookup-results">
        {projectResults.slice(0, 8).map((project) => (
          <button
            type="button"
            key={project}
            className="lookup-option"
            onClick={() => selectQuoteProject(project)}
          >
            <strong>{project}</strong>
          </button>
        ))}
      </div>
    )}

    {projectSearchMessage && (
      <div className="lookup-message">{projectSearchMessage}</div>
    )}
  </div>
</label>

        <label
  className={
    showCopiedRequired && !quoteForm.to_company
      ? "required-missing"
      : ""
  }
>
          Customer
          <div className="lookup-field">
            <input
              name="to_company"
              placeholder="Search Customer / Company"
              value={quoteForm.to_company}
              onChange={(e) => searchQuoteCompanies(e.target.value)}
            />

            {companyResults.length > 0 && (
              <div className="lookup-results">
                {companyResults.slice(0, 8).map((company) => (
                  <button
                    type="button"
                    key={company.id}
                    className="lookup-option"
                    onClick={() => selectQuoteCompany(company)}
                  >
                    <strong>{company.name}</strong>
                    <span>{company.type || ""}</span>
                  </button>
                ))}
              </div>
            )}

{companySearchMessage && (
  <button
    type="button"
    className="btn secondary"
    onClick={addQuoteCompany}
  >
    Add Company
  </button>
)}
          </div>
        </label>

        <label
  className={
    showCopiedRequired && !quoteForm.attention
      ? "required-missing"
      : ""
  }
>
          Contact / Attention
          <div className="lookup-field">
            <input
              name="attention"
              placeholder="Search Contact / Attention"
              value={quoteForm.attention}
              onChange={(e) => searchQuoteContacts(e.target.value)}
            />

            {contactResults.length > 0 && (
              <div className="lookup-results">
                {contactResults.slice(0, 8).map((contact) => (
                  <button
                    type="button"
                    key={contact.id}
                    className="lookup-option"
                    onClick={() => selectQuoteContact(contact)}
                  >
                    <strong>
                      {`${contact.first_name || ""} ${contact.last_name || ""}`.trim()}
                    </strong>
                    <span>{contact.email || ""}</span>
                  </button>
                ))}
              </div>
            )}

{contactSearchMessage && selectedCompanyId && (
  <button
    type="button"
    className="btn secondary"
    onClick={addQuoteContact}
  >
    Add Contact
  </button>
)}
          </div>
        </label>

<label>
  Location
  <div className="lookup-field">
    <input
      name="location"
      placeholder="e.g. San Francisco, CA"
      value={quoteForm.location}
      onChange={(e) => searchQuoteLocations(e.target.value)}
    />

    {locationResults.length > 0 && (
      <div className="lookup-results">
        {locationResults.slice(0, 8).map((location) => (
          <button
            type="button"
            key={location}
            className="lookup-option"
            onClick={() => selectQuoteLocation(location)}
          >
            <strong>{location}</strong>
          </button>
        ))}
      </div>
    )}

  </div>
</label>



<label
  className={
    showCopiedRequired &&
    contactToArray(quoteForm.contact).length === 0
      ? "required-missing"
      : ""
  }
>

  Outside Sales Contact(s)

  <div className="checkbox-group">

    {[
      "Mike Llorence",
      "Phil Haas",
      "Luke Hanzlik",
      "Alex White",
      "Mark Labitad",
      "Rhiannon Canas",
      "Megan McCabe",
      "Hazel Caling",
    ].map((name) => (
      <label key={name} className="check-option">
        <input
          type="checkbox"
checked={contactToArray(quoteForm.contact).includes(name)}
          onChange={(e) => {
const current = contactToArray(quoteForm.contact);

            if (e.target.checked) {
              current.push(name);
            } else {
              const index = current.indexOf(name);
              if (index > -1) current.splice(index, 1);
            }

            setQuoteForm((prev) => ({
              ...prev,
              contact: current,
            }));
          }}
        />

        {name}
      </label>
    ))}
  </div>
</label>

<label>
  Quote #
  <input
    type="text"
    name="quote_number"
    placeholder="Enter quote number"
    value={quoteForm.quote_number || ""}
    onChange={updateForm(setQuoteForm)}
  />
</label>

<label>
  Quote Date
  <input
    type="date"
    name="date"
    value={quoteForm.date || ""}
    onChange={updateForm(setQuoteForm)}
  />
</label>



        
<label>
  Bid Due Date (Leave blank if none)
  <input
    type="date"
    name="bid_date"
    value={quoteForm.bid_date === "N/A" ? "" : quoteForm.bid_date}
    onChange={updateForm(setQuoteForm)}
  />
</label>

        <label>
          Status
          <select
            name="status"
            value={quoteForm.status}
            onChange={updateForm(setQuoteForm)}
          >
            <option>Not Started</option>
            <option>Pending Instruction from Sales</option>
            <option>In Progress</option>
            <option>Bid Submitted</option>
            <option>Bid Submitted - to Sales</option>
            <option>Not Bidding</option>
            <option>Won</option>
            <option>Lost</option>
          </select>
        </label>

        <label>
          Freight Terms
          <select
            name="freight_terms"
            value={quoteForm.freight_terms || "FOB"}
            onChange={updateForm(setQuoteForm)}
          >
            <option value="FOB">FOB</option>
            <option value="FFA">FFA</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>

        {quoteForm.freight_terms === "CUSTOM" && (
          <label style={{ gridColumn: "1 / -1" }}>
            Custom Freight Message
            <textarea
              name="freight_note"
              rows={2}
              placeholder="Type the freight message to print on the quote"
              value={quoteForm.freight_note || ""}
              onChange={updateForm(setQuoteForm)}
            />
          </label>
        )}

        <label style={{ gridColumn: "1 / -1" }}>
          Notes
          <textarea
            name="notes"
            placeholder="Quote Notes"
            value={quoteForm.notes}
            onChange={updateForm(setQuoteForm)}
          />
        </label>

        



<div className="button-row">
<button
  className="btn primary"
  disabled={!isCopiedQuoteReadyToSave || quoteBusy}
>
  {quoteBusy
    ? editingQuoteId
      ? "Updating..."
      : "Saving..."
    : editingQuoteId
      ? "Update Quote"
      : "Save Quote"}
</button>

  <button
    type="button"
    className="btn secondary"
    onClick={clearQuoteForm}
  >
    {editingQuoteId ? "Cancel Edit" : "New Quote / Clear Form"}
  </button>
<button
  type="button"
  className="btn secondary"
  onClick={pasteCopiedQuote}
  disabled={!copiedQuote}
>
  Paste Copied Quote
</button>
</div>



{quoteMessage && (
  <div className="quote-message">
    {quoteMessage}
  </div>
)}
{showCopiedRequired && !isCopiedQuoteReadyToSave && (
  <div className="required-save-message">
    Complete Customer, Attn To, and Outside Sales before saving copied quote.
  </div>
)}
      </form>

      <div className="card active-quote-card">
        <h3>Active Quote</h3>
        {activeQuote ? (
<>
  <p>
    <b>Date:</b>   {quoteForm.date
    ? new Date(quoteForm.date).toLocaleDateString("en-US")
    : ""}
  </p>
  <p>
    <b>Quote#:</b> {activeQuote.quote_number}
  </p>
    <p>
    <b>Contact:</b> {formatContact(activeQuote.contact)}
  </p>

  <p>
    <b>Project:</b> {activeQuote.project || "-"}
  </p>
    <p>
    <b>Bid Date:</b> {activeQuote.bid_date || "-"}
  </p>

  <p>
    <b>Customer:</b> {activeQuote.to_company || "-"}
  </p>

  <p>
    <b>Attn To:</b> {activeQuote.attention || "-"}
  </p>
    <p>
    <b>Location:</b> {activeQuote.location || "-"}
  </p>



  <p>
    <b>Total:</b> {money(activeQuote.total)}
  </p>
    <p>
    <b>Freight Terms:</b> {activeQuote.freight_terms || "-"}
  </p>
    <p>
    <b>Notes:</b> {activeQuote.notes || "-"}
  </p>

  <div className="button-row">
        <button
      className="btn secondary"
      type="button"
      onClick={() => editQuote(activeQuote)}
    >
      Edit
    </button>

    <button
      className="btn secondary"
      type="button"
      onClick={() => previewQuotePdf(activeQuote)}
    >
      Preview PDF
    </button>

    <button
      className="btn secondary"
      type="button"
      onClick={() => downloadQuotePdf(activeQuote)}
    >
      Download PDF
    </button>
  </div>

  
</>
        ) : (
          <p>Select or save a quote first.</p>
        )}
      </div>
    </div>


      {lineItemMessage && (
  <div className="line-item-message">
    {lineItemMessage}
  </div>
)}
<div className={`line-item-wrapper ${!activeQuoteId && !isCopyDraft ? "disabled-section" : ""}`}>

{!activeQuoteId && !isCopyDraft && (
    <div className="disabled-overlay-message">
      Save or select a quote first.
    </div>
  )}

  <form className="card line-grid" onSubmit={saveLineItem}>
    <h3>Line Item {activeQuote ? `for ${activeQuote.quote_number}` : ""}</h3>

      <label>
        Tag
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            margin: "6px 0 8px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#555" }}>Select text, then:</span>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("tag", "highlight")}>Highlight</button>
        </div>
        <textarea
          ref={tagRef}
          className="tag-textarea"
          name="tag"
          placeholder="Highlight tag text, then pick a style"
          value={lineItemForm.tag}
          onChange={updateForm(setLineItemForm)}
          rows={4}
        />
      </label>


      <label>
        Item / Model / Part #
        <div className="lookup-field">
          <input
            name="item"
            placeholder="Search item / model / part #"
            value={lineItemForm.item}
            onChange={(e) => searchLineProducts(e.target.value)}
          />

          {lineProductResults.length > 0 && (
            <div className="lookup-results">
              {lineProductResults.slice(0, 8).map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="lookup-option"
                  onClick={() => selectLineProduct(p)}
                >
                  <strong>
  {[p.category, p.part_number, p.model, p.name]
    .filter(Boolean)
    .join(" | ")}
</strong>
<span>
  {[p.vendor, p.series]
    .filter(Boolean)
    .join(" | ")}
</span>

<small>
  {p.description?.substring(0, 80)}
  {p.description?.length > 80 ? "..." : ""}
</small>
                </button>
              ))}
            </div>
          )}

          {lineProductSearchMessage && (
            <div className="lookup-message">{lineProductSearchMessage}</div>
          )}
        </div>
      </label>


      <label>
        Vendor
        <input
          name="vendor"
          placeholder="Vendor"
          value={lineItemForm.vendor}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Qty
        <input
          name="qty"
          type="number"
          placeholder="Qty"
          value={lineItemForm.qty}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label style={{ gridColumn: "span 2" }}>
        Description
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            margin: "6px 0 8px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#555" }}>Select text, then:</span>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("description", "header")}>Header</button>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("description", "bold")}>Bold</button>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("description", "italic")}>Italic</button>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("description", "highlight")}>Highlight</button>
          <button type="button" className="btn secondary" style={{ color: "#c00" }} onClick={() => applyFieldStyle("description", "red")}>Red</button>
          <button type="button" className="btn secondary" style={{ color: "#1d4ed8" }} onClick={() => applyFieldStyle("description", "blue")}>Blue</button>
          <button type="button" className="btn secondary" style={{ color: "#15803d" }} onClick={() => applyFieldStyle("description", "green")}>Green</button>
          <button type="button" className="btn secondary" onClick={() => applyFieldStyle("description", "clear")}>Clear style</button>
        </div>
        <textarea
          ref={descriptionRef}
          className="description-box"
          name="description"
          placeholder="Highlight text above, then pick Bold / Highlight / a color"
          value={lineItemForm.description}
          onChange={updateForm(setLineItemForm)}
        />
      </label>


      <label>
        List Price
        <input
          name="list_price"
          type="number"
          step="0.01"
          placeholder="List Price"
          value={lineItemForm.list_price}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Surcharge
        <input
          name="surcharge"
          type="number"
          step="0.0001"
          placeholder="Surcharge .10"
          value={lineItemForm.surcharge}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Multiplier
        <input
          name="multiplier"
          type="number"
          step="0.0001"
          placeholder="Multiplier"
          value={lineItemForm.multiplier}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Markup
        <input
          name="markup"
          type="number"
          step="0.0001"
          placeholder="Markup .25"
          value={lineItemForm.markup}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Freight
        <input
          name="freight"
          type="number"
          step="0.01"
          placeholder="Freight"
          value={lineItemForm.freight}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Startup
        <input
          name="startup"
          type="number"
          step="0.01"
          placeholder="Startup"
          value={lineItemForm.startup}
          onChange={updateForm(setLineItemForm)}
        />
      </label>

      <label>
        Terms
        <select
          name="terms"
          value={lineItemForm.terms}
          onChange={updateForm(setLineItemForm)}
        >
          <option value="FFA">FFA</option>
          <option value="FOB">FOB</option>
        </select>
      </label>

<label>
  Notes
  <textarea
    name="notes"
    placeholder="Notes"
    value={lineItemForm.notes}
    onChange={updateForm(setLineItemForm)}
    rows={4}                    // You can change this to 3 or 4 if you want more space
    style={{ resize: "vertical", minHeight: "50px" }}
  />
</label>

      <label className="check">
        <input
          type="checkbox"
          name="included"
          checked={lineItemForm.included}
          onChange={updateForm(setLineItemForm)}
        />
        Included
      </label>

      <div className="calc-box">
        Net: {money(calculatedPreview.net)} | Sell: {money(calculatedPreview.sell)} |
        Total: {money(calculatedPreview.total)}
      </div>

<div className="button-row" style={{ marginTop: "15px" }}>
  <button className="btn primary">
    {editingLineItemId ? "Update Line Item" : "Add Line Item"}
  </button>

  {editingLineItemId && (
    <button 
      type="button" 
      className="btn secondary"
      onClick={() => {
        setEditingLineItemId(null);
        setLineItemForm(emptyLineItem);
      }}
    >
      Cancel
    </button>
  )}
</div>
    </form>
    </div>

{/* <div style={{ 
      gridColumn: "1 / -1", 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center",
      margin: "20px 0 25px 0",
      padding: "12px 0",
      backgroundColor: "#f8f9fa",
      borderRadius: "8px"
    }}>
      <label className="check" style={{ 
        fontSize: "1.15rem", 
        fontWeight: "600", 
        display: "flex", 
        alignItems: "center", 
        gap: "12px", 
        cursor: "pointer" 
      }}>
        <input
          type="checkbox"
          name="showNoSpec"
          checked={quoteForm.showNoSpec !== false}
          onChange={updateForm(setQuoteForm)}
          style={{ width: "22px", height: "22px", accentColor: "red" }}
        />
        No Specifications Provided
      </label>
    </div> */}

    {(activeQuote || isCopyDraft) && (
      <div className="card table-wrap">
        <h3>Line Items</h3>

        <table className="line-items-table">
          <thead>
            <tr>
              <th></th>
                            {/* <th>Item</th>
              <th>Vendor</th> */}
              <th>Tag</th>
              <th>Description</th>
              <th>List</th>
              <th>Surcharge</th>
              <th>Multiplier</th>
              <th>Net</th>
              <th>Markup</th>
  
              <th>Startup</th>
                          <th>Freight</th>
              <th>Terms</th>
              <th>Sell</th>
                            <th>Qty</th>
              <th>Total</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {(isCopyDraft ? draftCopiedLineItems : activeQuote.line_items || []).map((item, index) => (
              <tr key={item.id}>
                <td
                  draggable
                  onDragStart={() => setDraggedLineItem(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropLineItem(item.id)}
                  className="drag"
                >
                  ☰
                </td>
                {/* <td>{item.item}</td>
                <td>{item.vendor}</td> */}
                <td>{item.tag}</td>

             

                <td className="description-cell">{getLineDescription(item)}</td>

                <td>{money(item.list_price)}</td>

                <td>
                  {item.surcharge
                    ? `${(Number(item.surcharge) * 100).toFixed(0)}%`
                    : ""}
                </td>

                <td>{item.multiplier || ""}</td>
                <td>{money(item.net_cost)}</td>

                <td>
                  {item.markup
                    ? `${(Number(item.markup) * 100).toFixed(0)}%`
                    : ""}
                </td>

             
                <td>{money(item.startup)}</td>
                   <td>{money(item.freight)}</td>
                <td>{item.terms || ""}</td>
                <td>{item.included ? "Included" : money(item.sell_price)}</td>
                   <td>{item.qty}</td>
                <td>{item.included ? "Included" : money(item.total_price)}</td>
                <td>{item.notes}</td>

                <td>
                  <button
                    className="btn edit"
                    type="button"
                    onClick={() => editLineItem(item)}
                  >
                    Edit
                  </button>

{!["notes", "startup", "freight", "adders"].includes(
  String(item.item || "").toLowerCase()
) && (
  <button
    className="btn secondary"
    type="button"
    onClick={() => openNotesModal(item)}
  >
    Notes
  </button>
)}

<button
  className="btn delete"
  type="button"
  disabled={deletingLineItemId === item.id}
  onClick={() => {
    if (isCopyDraft) {
      setDraftCopiedLineItems((prev) =>
        prev.filter((_, i) => i !== index)
      );
    } else {
      deleteLineItem(item.id);
    }
  }}
>
  {deletingLineItemId === item.id ? "Deleting..." : "Delete"}
</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
  }



//   function CrudTable({ type }) {

//     const config = {
//       products: {
//         title: "Products",
//         search: productSearch,
//         setSearch: setProductSearch,
//         refresh: () => fetchProducts(productSearch),
//         endpoint: "products",
//         form: productForm,
//         setForm: setProductForm,
//         empty: emptyProduct,
//         editingId: editingProductId,
//         setEditingId: setEditingProductId,
//         rows: products,
//         fields: ["name", "category", "type", "series", "model", "part_number", "description", "notes", "tag", "list_price", "multiplier", "surcharge", "vendor", "manufacturer", ],
//       },
//       notes: {
//         title: "Notes Library",
//         search: noteSearch,
//         setSearch: setNoteSearch,
//         refresh: () => fetchNotes(noteSearch),
//         endpoint: "notes-library",
//         form: noteForm,
//         setForm: setNoteForm,
//         empty: emptyNote,
//         editingId: editingNoteId,
//         setEditingId: setEditingNoteId,
//         rows: notes,
//         fields: ["item", "type", "category", "series", "model", "note_type", "text", "sort_order"],
//       },
//       companies: {
//         title: "Companies",
//         search: companySearch,
//         setSearch: setCompanySearch,
//         refresh: () => fetchCompanies(companySearch),
//         endpoint: "companies",
//         form: companyForm,
//         setForm: setCompanyForm,
//         empty: emptyCompany,
//         editingId: editingCompanyId,
//         setEditingId: setEditingCompanyId,
//         rows: companies,
//         fields: ["name", "type", "city", "state", "website", "notes", "address1", "address2", "zipcode", "account_number", "payment_terms", ],
//       },
//       contacts: {
//         title: "Contacts",
//         search: contactSearch,
//         setSearch: setContactSearch,
//         refresh: () => fetchContacts(contactSearch),
//         endpoint: "contacts",
//         form: contactForm,
//         setForm: setContactForm,
//         empty: emptyContact,
//         editingId: editingContactId,
//         setEditingId: setEditingContactId,
//         rows: contacts,
//         fields: [
//   "company_id",
//   "first_name",
//   "last_name",
//   "role",
//   "email",
//   "notes",
//   "tel",
//   "mobile",
// ],
// displayFields: [
//   "company_id",
//   "company_name",
//   "first_name",
//   "last_name",
//   "role",
//   "email",
//   "notes",
//   "tel",
//   "mobile",
// ],
//       },
//     }[type];

//     return (
//       <section className="screen">
//         <div className="toolbar">
//           <input placeholder={`Search ${config.title}`} value={config.search} onChange={(e) => config.setSearch(e.target.value)} />
//           <button className="btn primary" onClick={config.refresh}>Search</button>
//         </div>

//         <form className="card form-grid" onSubmit={(e) => saveCrud(e, config.endpoint, config.form, config.editingId, () => config.setForm(config.empty), config.refresh, config.setEditingId)}>
//           <h3>{config.editingId ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
//           {type === "contacts" && (
//             <select name="company_id" value={config.form.company_id} onChange={updateForm(config.setForm)}>
//               <option value="">Select Company</option>
//               {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
//             </select>
//           )}
//           {config.fields.filter((f) => !(type === "contacts" && f === "company_id")).map((field) => {
//     const isLongField =
//       field === "description" || field === "notes" || field === "text";

//     const useProductLookup =
//       type === "products" &&
//       [
//         "name",
//         "tag",
//         "vendor",
//         "manufacturer",
//         "category",
//         "type",
//         "series",
//         "model",
//         "part_number",
//       ].includes(field);

//       const useCompanyLookup =
//   type === "companies" &&
//   ["name", "city"].includes(field);

//   if (type === "companies" && field === "state") {
//   return (
//     <select
//       key={field}
//       name={field}
//       value={config.form[field] || ""}
//       onChange={updateForm(config.setForm)}
//     >
//       <option value="">Select State</option>

//       <option value="AL">AL</option>
//       <option value="AK">AK</option>
//       <option value="AZ">AZ</option>
//       <option value="AR">AR</option>
//       <option value="CA">CA</option>
//       <option value="CO">CO</option>
//       <option value="CT">CT</option>
//       <option value="DE">DE</option>
//       <option value="FL">FL</option>
//       <option value="GA">GA</option>
//       <option value="HI">HI</option>
//       <option value="ID">ID</option>
//       <option value="IL">IL</option>
//       <option value="IN">IN</option>
//       <option value="IA">IA</option>
//       <option value="KS">KS</option>
//       <option value="KY">KY</option>
//       <option value="LA">LA</option>
//       <option value="ME">ME</option>
//       <option value="MD">MD</option>
//       <option value="MA">MA</option>
//       <option value="MI">MI</option>
//       <option value="MN">MN</option>
//       <option value="MS">MS</option>
//       <option value="MO">MO</option>
//       <option value="MT">MT</option>
//       <option value="NE">NE</option>
//       <option value="NV">NV</option>
//       <option value="NH">NH</option>
//       <option value="NJ">NJ</option>
//       <option value="NM">NM</option>
//       <option value="NY">NY</option>
//       <option value="NC">NC</option>
//       <option value="ND">ND</option>
//       <option value="OH">OH</option>
//       <option value="OK">OK</option>
//       <option value="OR">OR</option>
//       <option value="PA">PA</option>
//       <option value="RI">RI</option>
//       <option value="SC">SC</option>
//       <option value="SD">SD</option>
//       <option value="TN">TN</option>
//       <option value="TX">TX</option>
//       <option value="UT">UT</option>
//       <option value="VT">VT</option>
//       <option value="VA">VA</option>
//       <option value="WA">WA</option>
//       <option value="WV">WV</option>
//       <option value="WI">WI</option>
//       <option value="WY">WY</option>
//     </select>
//   );
// }

// const useNoteLookup =
//   type === "notes" &&
//   ["item", "type", "category", "series", "model"].includes(field);

//   const noteLinkFields = ["type", "category", "series", "model"];

// const activeNoteLinkField =
//   type === "notes"
//     ? noteLinkFields.find(
//         (f) => String(config.form[f] || "").trim()
//       )
//     : null;

// const isDisabledNoteLinkField =
//   type === "notes" &&
//   noteLinkFields.includes(field) &&
//   activeNoteLinkField &&
//   activeNoteLinkField !== field;
  

//     const placeholder =
//       type === "products" || type === "notes"
//         ? ({
//             name: "Product Name e.g. Non-Condensing Hydronic Heating Boiler",
//             category: "Category e.g. Boiler, Pump, Tank, Startup, Notes, Freight, Adders, Parts",
//             type: "Type e.g. Condensing, End Suction, Storage Tank",
//           }[field] || field)
//         : field;

//     if (isLongField) {
//       return (
//         <textarea
//           key={field}
//           name={field}
//           placeholder={placeholder}
//           value={config.form[field] || ""}
//           onChange={updateForm(config.setForm)}
//         />
//       );
//     }

//     if (field === "note_type") {
//       return (
//         <select
//           key={field}
//           name={field}
//           value={config.form[field] || "standard"}
//           onChange={updateForm(config.setForm)}
//         >
//           <option value="standard">standard</option>
//           <option value="additional">additional</option>
//           <option value="exception">exception</option>
//           <option value="internal">internal</option>
//         </select>
//       );
//     }

//     if (type === "companies" && field === "type") {
//   return (
//     <select
//       key={field}
//       name={field}
//       value={config.form[field] || ""}
//       onChange={updateForm(config.setForm)}
//     >
//       <option value="">Select Type</option>
//       <option value="vendor">vendor</option>
//       <option value="contractor">contractor</option>
//       <option value="wholesaler">wholesaler</option>
//       <option value="end-user">end-user</option>
//     </select>
//   );
// }

// if (useCompanyLookup) {
//   const suggestions = uniqueCompanyValues(field, config.form[field]);

//   return (
//     <div key={field} className="lookup-field">
//       <input
//         name={field}
//         placeholder={placeholder}
//         value={config.form[field] || ""}
//         onChange={(e) => {
//   setActiveLookupField(`companies-${field}`);
//   updateForm(config.setForm)(e);
// }}
//       />

//       {activeLookupField === `companies-${field}` && suggestions.length > 0 && (
//         <div className="lookup-results">
//           {suggestions.map((value) => (
//             <button
//               type="button"
//               key={value}
//               className="lookup-option"
//  onClick={() => {
//   config.setForm((prev) => ({
//     ...prev,
//     [field]: value,
//   }));
//   setActiveLookupField(null);
// }}
//             >
//               <strong>{value}</strong>
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// if (useNoteLookup) {
//   const suggestions = uniqueNoteValues(field, config.form[field]);

//   return (
//     <div key={field} className="lookup-field">
// <input
//   name={field}
//   placeholder={placeholder}
//   value={config.form[field] || ""}
//   disabled={isDisabledNoteLinkField}
//   title={
//     isDisabledNoteLinkField
//       ? "Only one filter may be used between Type, Category, Series, and Model."
//       : ""
//   }
//   onChange={(e) => {
//   setActiveLookupField(`notes-${field}`);
//   updateForm(config.setForm)(e);
// }}
// />

//       {activeLookupField === `notes-${field}` && suggestions.length > 0 && (
//         <div className="lookup-results">
//           {suggestions.map((value) => (
//             <button
//               type="button"
//               key={value}
//               className="lookup-option"
//     onClick={() => {
//   config.setForm((prev) => ({
//     ...prev,
//     [field]: value,
//   }));
//   setActiveLookupField(null);
// }}
//             >
//               <strong>{value}</strong>
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// if (useProductLookup) {
//   const suggestions = uniqueProductValues(field, config.form[field]);

//   return (
//     <div key={field} className="lookup-field">
//       <input
//         name={field}
//         placeholder={placeholder}
//         value={config.form[field] || ""}
//         onChange={(e) => {
//   setActiveLookupField(`products-${field}`);
//   updateForm(config.setForm)(e);
// }}
//       />

//       {activeLookupField === `products-${field}` && suggestions.length > 0 && (
//         <div className="lookup-results">
//           {suggestions.map((value) => (
//             <button
//               type="button"
//               key={value}
//               className="lookup-option"
// onClick={() => {
//   config.setForm((prev) => ({
//     ...prev,
//     [field]: value,
//   }));
//   setActiveLookupField(null);
// }}
//             >
//               <strong>{value}</strong>
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// return (
// <input
//   key={field}
//   name={field}
//   placeholder={placeholder}
//   value={config.form[field] || ""}
//   disabled={isDisabledNoteLinkField}
//   title={
//     isDisabledNoteLinkField
//       ? "Only one filter may be used between Type, Category, Series, and Model."
//       : ""
//   }
//   onChange={updateForm(config.setForm)}
// />
// );



//     if (useProductLookup) {
//       const suggestions = uniqueProductValues(field, config.form[field]);

//       return (
//         <div key={field} className="lookup-field">
//           <input
//             name={field}
//             placeholder={placeholder}
//             value={config.form[field] || ""}
//             onChange={updateForm(config.setForm)}
//           />

//           {suggestions.length > 0 && (
//             <div className="lookup-results">
//               {suggestions.map((value) => (
//                 <button
//                   type="button"
//                   key={value}
//                   className="lookup-option"
//                   onClick={() =>
//                     config.setForm((prev) => ({
//                       ...prev,
//                       [field]: value,
//                     }))
//                   }
//                 >
//                   <strong>{value}</strong>
//                 </button>
//               ))}
//             </div>
//           )}
//         </div>
//       );
//     }

//     return (
//       <input
//         key={field}
//         name={field}
//         placeholder={placeholder}
//         value={config.form[field] || ""}
//         onChange={updateForm(config.setForm)}
//       />
//     );
//   })}
//           <button className="btn primary">{config.editingId ? "Update" : "Add"}</button>
//           <button
//   type="button"
//   className="btn secondary"
//   onClick={() => {
//     config.setEditingId(null);
//     config.setForm(config.empty);
//   }}
// >
//   Cancel
// </button>
//         </form>

//         <div className="card table-wrap">
//           <table className="data-table">
//             <thead>
//               {/* <tr>{config.fields.slice(0, 8).map((f) => <th key={f}>{f}</th>)}<th>Actions</th></tr> */}
//               <tr>{(config.displayFields || config.fields).slice(0, 8).map((f) => <th key={f}>{f}</th>)}<th>Actions</th></tr>

//             </thead>
 
//             <tbody>
//   {config.rows.map((row) => (
//     <tr key={row.id}>
//       {(config.displayFields || config.fields).slice(0, 8).map((f) => (
//         <td key={f}>{String(row[f] ?? "")}</td>
//       ))}
//       <td>
//         <button
//           className="btn edit"
//           onClick={() => {
//             config.setEditingId(row.id);
//             config.setForm({ ...config.empty, ...row });
//           }}
//         >
//           Edit
//         </button>
//         <button
//           className="btn delete"
//           onClick={() =>
//             deleteCrud(config.endpoint, row.id, config.refresh)
//           }
//         >
//           Delete
//         </button>
//       </td>
//     </tr>
//   ))}
// </tbody>
//           </table>
//         </div>
//       </section>
//     );
//   }

  function CrudTable({ type }) {

    const config = {
      products: {
        title: "Products",
        search: productSearch,
        setSearch: setProductSearch,
        refresh: () => fetchProducts(productSearch),
        endpoint: "products",
        form: productForm,
        setForm: setProductForm,
        empty: emptyProduct,
        editingId: editingProductId,
        setEditingId: setEditingProductId,
        rows: products,
        fields: ["name", "category", "type", "series", "model", "part_number", "description", "notes", "tag", "list_price", "multiplier", "surcharge", "vendor", "manufacturer", ],
      },
      notes: {
        title: "Notes Library",
        search: noteSearch,
        setSearch: setNoteSearch,
        refresh: () => fetchNotes(noteSearch),
        endpoint: "notes-library",
        form: noteForm,
        setForm: setNoteForm,
        empty: emptyNote,
        editingId: editingNoteId,
        setEditingId: setEditingNoteId,
        rows: notes,
        fields: ["item", "type", "category", "series", "model", "note_type", "text", "sort_order"],
      },
      companies: {
        title: "Companies",
        search: companySearch,
        setSearch: setCompanySearch,
        refresh: () => fetchCompanies(companySearch),
        endpoint: "companies",
        form: companyForm,
        setForm: setCompanyForm,
        empty: emptyCompany,
        editingId: editingCompanyId,
        setEditingId: setEditingCompanyId,
        rows: companies,
        fields: ["name", "type", "city", "state", "website", "notes", "address1", "address2", "zipcode", "account_number", "payment_terms", ],
      },
      contacts: {
        title: "Contacts",
        search: contactSearch,
        setSearch: setContactSearch,
        refresh: () => fetchContacts(contactSearch),
        endpoint: "contacts",
        form: contactForm,
        setForm: setContactForm,
        empty: emptyContact,
        editingId: editingContactId,
        setEditingId: setEditingContactId,
        rows: contacts,
        fields: [
  "company_id",
  "first_name",
  "last_name",
  "role",
  "email",
  "notes",
  "tel",
  "mobile",
],
displayFields: [
  "company_id",
  "company_name",
  "first_name",
  "last_name",
  "role",
  "email",
  "notes",
  "tel",
  "mobile",
],
      },
    }[type];

    // Pagination
    const totalItems = config.rows.length;
    const totalPages = Math.ceil(totalItems / crudPageSize) || 1;
    const pagedRows = config.rows.slice(
      (crudPage - 1) * crudPageSize,
      crudPage * crudPageSize
    );

    return (
      <section className="screen">
        <div className="toolbar">
          <input placeholder={`Search ${config.title}`} value={config.search} onChange={(e) => config.setSearch(e.target.value)} />
          <button className="btn primary" onClick={config.refresh}>Search</button>
        </div>

        <form className="card form-grid" onSubmit={(e) => saveCrud(e, config.endpoint, config.form, config.editingId, () => config.setForm(config.empty), config.refresh, config.setEditingId)}>
          <h3>{config.editingId ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
          {type === "contacts" && (
            <select name="company_id" value={config.form.company_id} onChange={updateForm(config.setForm)}>
              <option value="">Select Company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {config.fields.filter((f) => !(type === "contacts" && f === "company_id")).map((field) => {
    const isLongField =
      field === "description" || field === "notes" || field === "text";

    const useProductLookup =
      type === "products" &&
      [
        "name",
        "tag",
        "vendor",
        "manufacturer",
        "category",
        "type",
        "series",
        "model",
        "part_number",
      ].includes(field);

      const useCompanyLookup =
  type === "companies" &&
  ["name", "city"].includes(field);

  if (type === "companies" && field === "state") {
  return (
    <select
      key={field}
      name={field}
      value={config.form[field] || ""}
      onChange={updateForm(config.setForm)}
    >
      <option value="">Select State</option>

      <option value="AL">AL</option>
      <option value="AK">AK</option>
      <option value="AZ">AZ</option>
      <option value="AR">AR</option>
      <option value="CA">CA</option>
      <option value="CO">CO</option>
      <option value="CT">CT</option>
      <option value="DE">DE</option>
      <option value="FL">FL</option>
      <option value="GA">GA</option>
      <option value="HI">HI</option>
      <option value="ID">ID</option>
      <option value="IL">IL</option>
      <option value="IN">IN</option>
      <option value="IA">IA</option>
      <option value="KS">KS</option>
      <option value="KY">KY</option>
      <option value="LA">LA</option>
      <option value="ME">ME</option>
      <option value="MD">MD</option>
      <option value="MA">MA</option>
      <option value="MI">MI</option>
      <option value="MN">MN</option>
      <option value="MS">MS</option>
      <option value="MO">MO</option>
      <option value="MT">MT</option>
      <option value="NE">NE</option>
      <option value="NV">NV</option>
      <option value="NH">NH</option>
      <option value="NJ">NJ</option>
      <option value="NM">NM</option>
      <option value="NY">NY</option>
      <option value="NC">NC</option>
      <option value="ND">ND</option>
      <option value="OH">OH</option>
      <option value="OK">OK</option>
      <option value="OR">OR</option>
      <option value="PA">PA</option>
      <option value="RI">RI</option>
      <option value="SC">SC</option>
      <option value="SD">SD</option>
      <option value="TN">TN</option>
      <option value="TX">TX</option>
      <option value="UT">UT</option>
      <option value="VT">VT</option>
      <option value="VA">VA</option>
      <option value="WA">WA</option>
      <option value="WV">WV</option>
      <option value="WI">WI</option>
      <option value="WY">WY</option>
    </select>
  );
}

const useNoteLookup =
  type === "notes" &&
  ["item", "type", "category", "series", "model"].includes(field);

  const noteLinkFields = ["type", "category", "series", "model"];

const activeNoteLinkField =
  type === "notes"
    ? noteLinkFields.find(
        (f) => String(config.form[f] || "").trim()
      )
    : null;

const isDisabledNoteLinkField =
  type === "notes" &&
  noteLinkFields.includes(field) &&
  activeNoteLinkField &&
  activeNoteLinkField !== field;
  

    const placeholder =
      type === "products" || type === "notes"
        ? ({
            name: "Product Name e.g. Non-Condensing Hydronic Heating Boiler",
            category: "Category e.g. Boiler, Pump, Tank, Startup, Notes, Freight, Adders, Parts",
            type: "Type e.g. Condensing, End Suction, Storage Tank",
          }[field] || field)
        : field;

    if (isLongField) {
      return (
        <textarea
          key={field}
          name={field}
          placeholder={placeholder}
          value={config.form[field] || ""}
          onChange={updateForm(config.setForm)}
        />
      );
    }

    if (field === "note_type") {
      return (
        <select
          key={field}
          name={field}
          value={config.form[field] || "standard"}
          onChange={updateForm(config.setForm)}
        >
          <option value="standard">standard</option>
          <option value="additional">additional</option>
          <option value="exception">exception</option>
          <option value="internal">internal</option>
        </select>
      );
    }

    if (type === "companies" && field === "type") {
  return (
    <select
      key={field}
      name={field}
      value={config.form[field] || ""}
      onChange={updateForm(config.setForm)}
    >
      <option value="">Select Type</option>
      <option value="vendor">vendor</option>
      <option value="contractor">contractor</option>
      <option value="wholesaler">wholesaler</option>
      <option value="end-user">end-user</option>
    </select>
  );
}

if (useCompanyLookup) {
  const suggestions = uniqueCompanyValues(field, config.form[field]);

  return (
    <div key={field} className="lookup-field">
      <input
        name={field}
        placeholder={placeholder}
        value={config.form[field] || ""}
        onChange={(e) => {
  setActiveLookupField(`companies-${field}`);
  updateForm(config.setForm)(e);
}}
      />

      {activeLookupField === `companies-${field}` && suggestions.length > 0 && (
        <div className="lookup-results">
          {suggestions.map((value) => (
            <button
              type="button"
              key={value}
              className="lookup-option"
 onClick={() => {
  config.setForm((prev) => ({
    ...prev,
    [field]: value,
  }));
  setActiveLookupField(null);
}}
            >
              <strong>{value}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

if (useNoteLookup) {
  const suggestions = uniqueNoteValues(field, config.form[field]);

  return (
    <div key={field} className="lookup-field">
<input
  name={field}
  placeholder={placeholder}
  value={config.form[field] || ""}
  disabled={isDisabledNoteLinkField}
  title={
    isDisabledNoteLinkField
      ? "Only one filter may be used between Type, Category, Series, and Model."
      : ""
  }
  onChange={(e) => {
  setActiveLookupField(`notes-${field}`);
  updateForm(config.setForm)(e);
}}
/>

      {activeLookupField === `notes-${field}` && suggestions.length > 0 && (
        <div className="lookup-results">
          {suggestions.map((value) => (
            <button
              type="button"
              key={value}
              className="lookup-option"
    onClick={() => {
  config.setForm((prev) => ({
    ...prev,
    [field]: value,
  }));
  setActiveLookupField(null);
}}
            >
              <strong>{value}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

if (useProductLookup) {
  const suggestions = uniqueProductValues(field, config.form[field]);

  return (
    <div key={field} className="lookup-field">
      <input
        name={field}
        placeholder={placeholder}
        value={config.form[field] || ""}
        onChange={(e) => {
  setActiveLookupField(`products-${field}`);
  updateForm(config.setForm)(e);
}}
      />

      {activeLookupField === `products-${field}` && suggestions.length > 0 && (
        <div className="lookup-results">
          {suggestions.map((value) => (
            <button
              type="button"
              key={value}
              className="lookup-option"
onClick={() => {
  config.setForm((prev) => ({
    ...prev,
    [field]: value,
  }));
  setActiveLookupField(null);
}}
            >
              <strong>{value}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

return (
<input
  key={field}
  name={field}
  placeholder={placeholder}
  value={config.form[field] || ""}
  disabled={isDisabledNoteLinkField}
  title={
    isDisabledNoteLinkField
      ? "Only one filter may be used between Type, Category, Series, and Model."
      : ""
  }
  onChange={updateForm(config.setForm)}
/>
);
          })}
          <button className="btn primary">{config.editingId ? "Update" : "Add"}</button>
          <button
  type="button"
  className="btn secondary"
  onClick={() => {
    config.setEditingId(null);
    config.setForm(config.empty);
  }}
>
  Cancel
</button>
        </form>

        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>{(config.displayFields || config.fields).slice(0, 8).map((f) => <th key={f}>{f}</th>)}<th>Actions</th></tr>
            </thead>
            <tbody>
  {pagedRows.map((row) => (
    <tr key={row.id}>
      {(config.displayFields || config.fields).slice(0, 8).map((f) => (
        <td key={f}>{String(row[f] ?? "")}</td>
      ))}
      <td>
        <button
          className="btn edit"
          onClick={() => {
            config.setEditingId(row.id);
            config.setForm({ ...config.empty, ...row });
          }}
        >
          Edit
        </button>
        <button
          className="btn delete"
          onClick={() =>
            deleteCrud(config.endpoint, row.id, config.refresh)
          }
        >
          Delete
        </button>
      </td>
    </tr>
  ))}
</tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn secondary" disabled={crudPage === 1} onClick={() => setCrudPage(p => Math.max(1, p-1))}>Previous</button>
              <span>Page {crudPage} of {totalPages}</span>
              <button className="btn secondary" disabled={crudPage === totalPages} onClick={() => setCrudPage(p => Math.min(totalPages, p+1))}>Next</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <h2>HTE Quotes</h2>
        <nav>
          <NavLink to="/">Quote Form</NavLink>
          <NavLink to="/dashboard">Quote Dashboard</NavLink>
          <NavLink to="/companies">Companies</NavLink>
          <NavLink to="/contacts">Contacts</NavLink>
          <NavLink to="/products">Products</NavLink>
          <NavLink to="/notes">Notes Library</NavLink>
          <button
  type="button"
  className="btn secondary"
  onClick={logout}
>
  Logout
</button>
        </nav>
      </header>

<Routes>
  <Route path="/" element={Builder()} />
  <Route path="/dashboard" element={Dashboard()} />

  <Route path="/companies" element={CrudTable({ type: "companies" })} />
  <Route path="/contacts" element={CrudTable({ type: "contacts" })} />
  <Route path="/products" element={CrudTable({ type: "products" })} />
  <Route path="/notes" element={CrudTable({ type: "notes" })} />
</Routes>

      {noteModalOpen && (
  <div className="modal-backdrop">
    <div className="modal">
      <div className="modal-head">
        <h3>Line Item Notes</h3>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setNoteModalOpen(false)}
        >
          Close
        </button>
      </div>

      <input
        placeholder="Search notes..."
        value={noteModalSearch}
        onChange={(e) => setNoteModalSearch(e.target.value)}
        style={{ width: "100%", marginBottom: "12px" }}
      />

      {["standard", "additional", "exception", "internal"].map((type) => {
        const filteredNotes = noteDrafts.filter((n) => {
          const search = noteModalSearch.toLowerCase();

          const matchesType = (n.note_type || "standard") === type;

          const matchesSearch =
            !search ||
            String(n.text || "").toLowerCase().includes(search) ||
            String(n.category || "").toLowerCase().includes(search) ||
            String(n.label || "").toLowerCase().includes(search) ||
            String(n.item || "").toLowerCase().includes(search) ||
            String(n.series || "").toLowerCase().includes(search) ||
            String(n.model || "").toLowerCase().includes(search);

          return matchesType && matchesSearch;
        });

        return (
          <div key={type} className="note-column">
            <h4>{type.toUpperCase()}</h4>

            {filteredNotes.length === 0 && (
              <p className="muted">No notes found.</p>
            )}

            {filteredNotes.map((n) => {
              const globalIndex = noteDrafts.indexOf(n);

              return (
                <div key={`${type}-${globalIndex}`} className="note-row">
                  <input
                    type="checkbox"
                    checked={!!n.is_selected}
                    onChange={(e) => {
                      const copy = [...noteDrafts];
                      copy[globalIndex] = {
                        ...copy[globalIndex],
                        is_selected: e.target.checked,
                      };
                      setNoteDrafts(copy);
                    }}
                  />

                  <textarea
                    value={n.text || ""}
                    onChange={(e) => {
                      const copy = [...noteDrafts];
                      copy[globalIndex] = {
                        ...copy[globalIndex],
                        text: e.target.value,
                      };
                      setNoteDrafts(copy);
                    }}
                  />

                  <button
                    type="button"
                    className="btn delete"
                    onClick={() =>
                      setNoteDrafts(noteDrafts.filter((_, i) => i !== globalIndex))
                    }
                  >
                    X
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="modal-actions">
        <button
          type="button"
          className="btn secondary"
          onClick={addCustomNote}
        >
          Add Custom Note
        </button>

        <button
          type="button"
          className="btn secondary"
          onClick={saveLineItemNotes}
        >
          Save Selected Notes
        </button>

        <button
          type="button"
          className="btn primary"
          onClick={addNotesToDescription}
        >
          Add These Notes Under Description
        </button>

        <button
          type="button"
          className="btn primary"
          onClick={addNotesAsSeparateLineItem}
        >
          Add These Notes As Separate Line
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

