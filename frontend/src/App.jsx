

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
  import.meta.env.VITE_API_URL || "http://localhost:5000" || "http://127.0.0.1:5000";

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
  const [insertAfterId, setInsertAfterId] = useState(null);
  const [lineVendorResults, setLineVendorResults] = useState([]);
  const [outsideSalesOpen, setOutsideSalesOpen] = useState(false);
  const [salesQuery, setSalesQuery] = useState("");
  const outsideSalesRef = useRef(null);
  const outsideSalesNames = [
    "Mike Llorence",
    "Phil Haas",
    "Luke Hanzlik",
    "Alex White",
    "Mark Labitad",
    "Rhiannon Canas",
    "Megan McCabe",
    "Hazel Caling",
  ];
  const [styleNote, setStyleNote] = useState("");
  const [tagColWidth, setTagColWidth] = useState(220);
  const HEADER_MAX = 40;
  const [lineSearchText, setLineSearchText] = useState("");
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
  const [dashColumnFilters, setDashColumnFilters] = useState({ sales: "", customer: "", location: "", status: "" });
  const [dashColumnOpen, setDashColumnOpen] = useState("");
  const [dashColumnQuery, setDashColumnQuery] = useState("");
  const dashColumnRef = useRef(null);

  const [productSearch, setProductSearch] = useState("");
  const [productFilters, setProductFilters] = useState({ category: "", type: "", series: "", model: "", vendor: "" });
  const [productFilterOpen, setProductFilterOpen] = useState("");
  const [productFilterQuery, setProductFilterQuery] = useState("");
  const productFilterRef = useRef(null);
  const [productFilterOptions, setProductFilterOptions] = useState({ category: [], type: [], series: [], model: [], vendor: [] });
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
    const qty = lineItemForm.qty === "" || lineItemForm.qty === null || lineItemForm.qty === undefined ? 1 : Number(lineItemForm.qty);
    const net = list * (1 + surcharge) * multiplier;
    const sell = Math.round(net * (1 + markup) + freight + startup);
    return { net, sell, total: sell * qty };
  }, [lineItemForm]);

  useEffect(() => {
    checkLogin();
  }, []);

  useEffect(() => {
    if (!dashColumnOpen) return undefined;
    const close = (event) => {
      if (dashColumnRef.current && !dashColumnRef.current.contains(event.target)) {
        setDashColumnOpen("");
        setDashColumnQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [dashColumnOpen]);

  useEffect(() => {
    const closeLookups = (event) => {
      const target = event.target;
      if (target && target.closest && target.closest(".lookup-field, .vendor-lookup, .sales-picker")) return;
      setProjectResults([]);
      setCompanyResults([]);
      setContactResults([]);
      setLocationResults([]);
      setLineProductResults([]);
      setLineVendorResults([]);
      setActiveLookupField(null);
    };
    document.addEventListener("mousedown", closeLookups);
    return () => document.removeEventListener("mousedown", closeLookups);
  }, []);

  useEffect(() => {
    if (!productFilterOpen) return undefined;
    const close = (event) => {
      if (productFilterRef.current && !productFilterRef.current.contains(event.target)) {
        setProductFilterOpen("");
        setProductFilterQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [productFilterOpen]);

  useEffect(() => {
    if (!outsideSalesOpen) return undefined;
    const close = (event) => {
      if (outsideSalesRef.current && !outsideSalesRef.current.contains(event.target)) {
        setOutsideSalesOpen(false);
        setSalesQuery("");
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOutsideSalesOpen(false);
        setSalesQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [outsideSalesOpen]);

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
  setDashColumnFilters({ sales: "", customer: "", location: "", status: "" });
  setDashColumnOpen("");
  setDashColumnQuery("");
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

  async function fetchProducts(search = "", filters = productFilters) {
    const res = await axios.get(`${API}/products`, { params: { search, ...filters } });
    setProducts(res.data);
    const hasFilter = Object.values(filters || {}).some(Boolean);
    if (!search && !hasFilter) {
      const uniq = (key) => [...new Set(res.data.map((row) => String(row[key] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      setProductFilterOptions({
        category: uniq("category"),
        type: uniq("type"),
        series: uniq("series"),
        model: uniq("model"),
        vendor: uniq("vendor"),
      });
    }
  }

  async function searchLineProducts(term) {
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


  function pdfPreviewHtml(value, kind) {
    const esc = (s) => String(s || "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
    const inline = (line) => {
      let html = esc(line);
      html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\/\/([\s\S]+?)\/\//g, "<em>$1</em>");
      html = html.replace(/\[hl\]([\s\S]+?)\[\/hl\]/g, "<mark>$1</mark>");
      html = html.replace(/\[red\]([\s\S]+?)\[\/red\]/g, '<span style="color:#c80000">$1</span>');
      html = html.replace(/\[blue\]([\s\S]+?)\[\/blue\]/g, '<span style="color:#325aa5">$1</span>');
      html = html.replace(/\[green\]([\s\S]+?)\[\/green\]/g, '<span style="color:#15803d">$1</span>');
      return html;
    };
    const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
    if (kind === "tag") {
      return lines.map((line) => {
        const header = line.match(/^\s*!!([\s\S]*?)!!\s*$/);
        let raw = header ? header[1] : line;
        const plain = raw.replace(/\[\/?[a-z]+\]/gi, "").replace(/\*\*/g, "").replace(/\/\//g, "").trim();
        const autoHl = /^[A-Za-z]+-\d/.test(plain);
        const optionSmall = /^Option\b/i.test(plain);
        const budgetary = /^Budgetary\b/i.test(plain);
        raw = raw.replace(/\(([\s\S]*?Specification[\s\S]*?)\)/gi, "//($1)//");
        raw = raw.replace(/(VE Option|Basis of Design)/gi, "[blue]$1[/blue]");
        raw = raw.replace(/\(Required\)/gi, "[red](Required)[/red]");
        let body = inline(raw);
        body = body.replace(/(\([^)]*Specification[^)]*\))/gi, '<span class="spec-size">$1</span>');
        if (optionSmall) body = `<span class="tag-option">${body}</span>`;
        if (budgetary) body = `<span class="tag-budgetary">${body}</span>`;
        if (autoHl && !optionSmall && !budgetary) body = `<mark>${body}</mark>`;
        const cls = [
          "tag-preview",
          optionSmall ? "option-line" : "",
          budgetary ? "budgetary-line" : "",
        ].filter(Boolean).join(" ");
        return body ? `<div class="${cls}">${body}</div>` : "";
      }).join("");
    }
    const blocks = [];
    let flow = [];
    const flush = () => {
      if (!flow.length) return;
      blocks.push({ type: "flow", text: flow.join(" ").replace(/\s+/g, " ").trim() });
      flow = [];
    };
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) { flush(); return; }
      const section = trimmed.match(/^!!(.+)!!$/);
      const boldHeader = trimmed.match(/^\*\*(.{1,40})\*\*$/);
      if (section || boldHeader) {
        flush();
        blocks.push({ type: "section", text: (section ? section[1] : boldHeader[1]).replace(/\*\*/g, "").trim() });
        return;
      }
      if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
        flush();
        blocks.push({ type: "bullet", text: trimmed.replace(/^[•-]\s*/, "") });
        return;
      }
      flow.push(trimmed);
    });
    flush();
    let usedBold = false;
    return blocks.map((block) => {
      if (block.type === "section") return `<div class="section">${inline(block.text)}</div>`;
      if (block.type === "bullet") {
        const red = block.text.includes("##");
        const bullet = inline(block.text.replace(/##/g, ""));
        return `<div class="bullet${red ? " red" : ""}">• ${bullet}</div>`;
      }
      if (!usedBold) {
        usedBold = true;
        const s = block.text;
        let idx = -1;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (ch !== "." && ch !== ",") continue;
          const prev = i > 0 ? s[i - 1] : "";
          const next = i + 1 < s.length ? s[i + 1] : "";
          if (/\d/.test(prev) && /\d/.test(next)) continue;
          idx = i;
          break;
        }
        if (idx === -1) return `<div><strong>${inline(s)}</strong></div>`;
        const lead = s.slice(0, idx + 1).trim();
        const rest = s.slice(idx + 1).trim();
        return `<div><strong>${inline(lead)}</strong>${rest ? ` ${inline(rest)}` : ""}</div>`;
      }
      return `<div>${inline(block.text)}</div>`;
    }).join("");
  }

  function markersToHtml(value) {
    const esc = (s) => String(s || "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
    return String(value || "").split("\n").map((line) => {
      const header = line.match(/^\s*!!([\s\S]*?)!!\s*$/);
      let html = esc(header ? header[1] : line);
      html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\/\/([\s\S]+?)\/\//g, "<em>$1</em>");
      html = html.replace(/\[hl\]([\s\S]+?)\[\/hl\]/g, "<mark>$1</mark>");
      html = html.replace(/\[red\]([\s\S]+?)\[\/red\]/g, '<span style="color:#c80000">$1</span>');
      html = html.replace(/\[blue\]([\s\S]+?)\[\/blue\]/g, '<span style="color:#325aa5">$1</span>');
      html = html.replace(/\[green\]([\s\S]+?)\[\/green\]/g, '<span style="color:#15803d">$1</span>');
      if (header) html = `<strong class="section">${html}</strong>`;
      return html || "<br>";
    }).join("<br>");
  }

  function htmlToMarkers(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    const inline = (node) => {
      if (node.nodeType === 3) return node.textContent || "";
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toLowerCase();
      if (tag === "br") return "\n";
      if (tag === "div" || tag === "p") return `\n${Array.from(node.childNodes).map(inline).join("")}`;
      let inner = Array.from(node.childNodes).map(inline).join("");
      const style = node.getAttribute("style") || "";
      const isSection = (tag === "b" || tag === "strong") && /\bsection\b/.test(node.className || "");
      if (isSection) {
        const bare = inner.replace(/\*\*/g, "").replace(/^!!|!!$/g, "").trim();
        return `!!${bare}!!`;
      }
      const bg = tag === "mark" || /background(-color)?:\s*(#ffe56a|yellow|rgb\(\s*255\s*,\s*229\s*,\s*106\s*\))/i.test(style);
      const color = /#c80000|#cc0000|rgb\(200,\s*0,\s*0\)/i.test(style) ? "red"
        : /#1d4ed8|#325aa5|rgb\(29,\s*78,\s*216\)|rgb\(50,\s*90,\s*165\)/i.test(style) ? "blue"
        : /#15803d|rgb\(21,\s*128,\s*61\)/i.test(style) ? "green" : "";
      if (tag === "b" || tag === "strong") inner = `**${inner}**`;
      if (tag === "i" || tag === "em") inner = `//${inner}//`;
      if (bg) inner = `[hl]${inner}[/hl]`;
      if (color) inner = `[${color}]${inner}[/${color}]`;
      return inner;
    };
    const root = doc.body.firstChild;
    const lines = [];
    let buf = "";
    const flush = () => { lines.push(buf); buf = ""; };
    Array.from(root.childNodes).forEach((node) => {
      const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : "";
      if (tag === "br") { flush(); return; }
      if (tag === "div" || tag === "p") {
        if (buf) flush();
        const inner = Array.from(node.childNodes).map(inline).join("").replace(/\n+$/g, "");
        inner.split("\n").forEach((line) => lines.push(line));
        return;
      }
      buf += inline(node);
    });
    if (buf || !lines.length) lines.push(buf);
    return lines.join("\n").replace(/\n+$/g, "");
  }

  function syncStyledField(field) {
    const el = field === "tag" ? tagRef.current : descriptionRef.current;
    if (!el) return;
    setLineItemForm((prev) => ({ ...prev, [field]: htmlToMarkers(el.innerHTML) }));
  }

  function applyWordStyle(field, style) {
    const el = field === "tag" ? tagRef.current : descriptionRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      setStyleNote("Highlight the text first, then click a style.");
      window.setTimeout(() => setStyleNote(""), 4000);
      return;
    }
    if (style === "header") {
      const selected = sel.toString().replace(/\s+/g, " ").trim();
      if (selected.length > HEADER_MAX) {
        setStyleNote(`Header max is ${HEADER_MAX} characters so it stays on one PDF line. You selected ${selected.length}. Shorten the highlight, then press H again.`);
        window.setTimeout(() => setStyleNote(""), 5000);
        return;
      }
      const markers = htmlToMarkers(el.innerHTML);
      let applied = false;
      const next = markers.split("\n").map((line) => {
        const bare = stripStyleMarkers(line);
        if (!selected || !bare.includes(selected)) return line;
        if (bare.length > HEADER_MAX) return line;
        applied = true;
        return `!!${bare}!!`;
      }).join("\n");
      if (!applied) {
        setStyleNote(`Header max is ${HEADER_MAX} characters. Select a short title line, not a full paragraph.`);
        window.setTimeout(() => setStyleNote(""), 5000);
        return;
      }
      el.innerHTML = markersToHtml(next);
      setLineItemForm((prev) => ({
        ...prev,
        [field]: next,
        ...(field === "description" ? { qty: 0 } : {}),
      }));
      setStyleNote(field === "description" ? "Header set. Qty set to 0." : "");
      if (field === "description") window.setTimeout(() => setStyleNote(""), 2500);
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    const applyOne = (command, value) => {
      document.execCommand("removeFormat");
      sel.removeAllRanges();
      sel.addRange(range);
      if (value === undefined) document.execCommand(command);
      else document.execCommand(command, false, value);
    };
    if (style === "clear") document.execCommand("removeFormat");
    else if (style === "bold") applyOne("bold");
    else if (style === "italic") applyOne("italic");
    else if (style === "highlight") applyOne("hiliteColor", "#ffe56a");
    else if (style === "red") applyOne("foreColor", "#c80000");
    syncStyledField(field);
  }

  function fillStyledFields(tag, description) {
    requestAnimationFrame(() => {
      if (tagRef.current) tagRef.current.innerHTML = markersToHtml(tag);
      if (descriptionRef.current) descriptionRef.current.innerHTML = markersToHtml(description);
    });
  }

  function beginAddLine(afterId) {
    setEditingLineItemId("new");
    setInsertAfterId(afterId || null);
    setLineItemForm(emptyLineItem);
    setLineSearchText("");
    setLineProductResults([]);
    setLineVendorResults([]);
    fillStyledFields("", "");
  }

  function beginEditLine(item) {
    setEditingLineItemId(item.id);
    setInsertAfterId(null);
    setLineItemForm({ ...emptyLineItem, ...item });
    setLineSearchText("");
    setLineProductResults([]);
    setLineVendorResults([]);
    fillStyledFields(item.tag || "", item.description || "");
  }

  function cancelLineEdit() {
    setEditingLineItemId(null);
    setInsertAfterId(null);
    setLineItemForm(emptyLineItem);
    setLineSearchText("");
    setLineProductResults([]);
    setLineVendorResults([]);
  }

  async function searchLineVendors(term) {
    setLineItemForm((prev) => ({ ...prev, vendor: term }));
    if (!term || term.length < 2) {
      setLineVendorResults([]);
      return;
    }
    const res = await axios.get(`${API}/companies`, { params: { search: term, type: "vendor" } });
    setLineVendorResults(
      (res.data || []).filter((c) => String(c.type || "").toLowerCase() === "vendor")
    );
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
    setLineItemForm((prev) => ({
      ...prev,
      [field]: next,
      ...(style === "header" && field === "description" ? { qty: 0 } : {}),
    }));
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
  if (e && e.preventDefault) e.preventDefault();

  if (!activeQuoteId && !isCopyDraft) return;

  setLineItemBusy(true);
  setLineItemMessage(editingLineItemId ? "Updating line item..." : "Adding line item...");

  try {
    const payload = { ...lineItemForm };
    if (tagRef.current) payload.tag = htmlToMarkers(tagRef.current.innerHTML);
    if (descriptionRef.current) payload.description = htmlToMarkers(descriptionRef.current.innerHTML);
    const descriptionLines = String(payload.description || "").split("\n").map((line) => line.trim()).filter(Boolean);
    if (descriptionLines.some((line) => /^!![\s\S]+!!$/.test(line))) payload.qty = 0;

    if (editingLineItemId && editingLineItemId !== "new") {
      await axios.put(`${API}/line-items/${editingLineItemId}`, payload);
      setEditingLineItemId(null);
      setLineItemMessage("Line item updated successfully.");
    } else if (isCopyDraft) {
      const newItem = { ...payload, id: `draft-${Date.now()}` };
      setDraftCopiedLineItems((prev) => {
        const items = [...prev];
        const at = insertAfterId ? items.findIndex((x) => x.id === insertAfterId) : items.length - 1;
        items.splice(Math.max(at, -1) + 1, 0, newItem);
        return items;
      });
      setEditingLineItemId(null);
      setLineItemMessage("Line item added successfully.");
    } else {
      const res = await axios.post(`${API}/quotes/${activeQuoteId}/line-items`, payload);
      const newId = res.data.id;
      const ids = (activeQuote.line_items || []).map((x) => x.id);
      const at = insertAfterId ? ids.indexOf(insertAfterId) : ids.length - 1;
      ids.splice(Math.max(at, -1) + 1, 0, newId);
      await axios.put(`${API}/quotes/${activeQuoteId}/line-items/reorder`, { item_ids: ids });
      setEditingLineItemId(null);
      setLineItemMessage("Line item added successfully.");
    }

    setInsertAfterId(null);
    setLineSearchText("");
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
    beginEditLine(item);
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
    try {
      if (editingId) await axios.put(`${API}/${endpoint}/${editingId}`, form);
      else await axios.post(`${API}/${endpoint}`, form);
      reset();
      setEditing(null);
      await refresh();
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || "Unable to save. Please try again.";
      alert(message);
    }
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
            const inner = text.slice(i + rule.open.length, end);
            const explicit = !!(rule.style.bold || rule.style.italic || rule.style.highlight || rule.style.color);
            tokens.push({
              text: inner,
              bold: explicit ? !!rule.style.bold : !!defaults.bold,
              italic: explicit ? !!rule.style.italic : !!defaults.italic,
              color: rule.style.color || (explicit ? null : defaults.color || null),
              highlight: !!rule.style.highlight,
            });
            i = end + rule.close.length;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
      const openHit = rules.find((rule) => rest.startsWith(rule.open));
      if (openHit) {
        i += openHit.open.length;
        continue;
      }
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

  const stripLeadMarks = (s) => String(s || "")
    .replace(/\*\*/g, "")
    .replace(/\/\//g, "")
    .replace(/\[hl\]|\[\/hl\]/g, "")
    .replace(/\[\/?(red|blue|green)\]/g, "");

  const drawFlowText = (fullText, firstBold) => {
    const trimmed = String(fullText || "").replace(/\s+/g, " ").trim();
    if (!trimmed) return;

    let boldPart = "";
    let restPart = trimmed;
    if (firstBold) {
      let splitIndex = findPhraseSplit(trimmed);
      if (splitIndex === -1) {
        boldPart = stripLeadMarks(trimmed);
        restPart = "";
      } else {
        boldPart = stripLeadMarks(trimmed.substring(0, splitIndex + 1)).trim();
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
    const boldPart = stripLeadMarks(splitIndex === -1 ? trimmed : trimmed.substring(0, splitIndex + 1)).trim();
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
      const boldHeader = trimmed.match(/^\*\*(.{1,40})\*\*$/);
      if (sectionMatch || boldHeader) {
        flushFlow();
        blocks.push({
          type: "section",
          text: (sectionMatch ? sectionMatch[1] : boldHeader[1]).replace(/\*\*/g, "").trim(),
        });
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
    markedTag = markedTag.replace(/^(Option\b.*)$/gim, "[opt]$1[/opt]");
    markedTag = markedTag.replace(/^(Budgetary\b.*)$/gim, "[bud]$1[/bud]");
    const markedLines = markedTag.replace(/\r\n/g, "\n").split("\n");
    let inSpec = false;
    let inBlue = false;
    let inReq = false;
    let inOpt = false;
    let inBud = false;
    markedLines.forEach((sourceLine) => {
      const linePlain = stripTagMarks(
        String(sourceLine)
          .replace(/\[spec\]|\[\/spec\]|\[autoBlue\]|\[\/autoBlue\]|\[req\]|\[\/req\]|\[opt\]|\[\/opt\]|\[bud\]|\[\/bud\]/g, "")
      ).trim();
      const autoHl = /^[A-Za-z]+-\d/.test(linePlain);
      const isOptLine = /^option\b/i.test(linePlain);
      const isBudLine = /^budgetary\b/i.test(linePlain);
      const pieces = String(sourceLine).split(/(\[spec\]|\[\/spec\]|\[autoBlue\]|\[\/autoBlue\]|\[req\]|\[\/req\]|\[opt\]|\[\/opt\]|\[bud\]|\[\/bud\])/);
      const tokens = [];
      pieces.forEach((part) => {
        if (part === "[spec]") { inSpec = true; return; }
        if (part === "[/spec]") { inSpec = false; return; }
        if (part === "[autoBlue]") { inBlue = true; return; }
        if (part === "[/autoBlue]") { inBlue = false; return; }
        if (part === "[req]") { inReq = true; return; }
        if (part === "[/req]") { inReq = false; return; }
        if (part === "[opt]") { inOpt = true; return; }
        if (part === "[/opt]") { inOpt = false; return; }
        if (part === "[bud]") { inBud = true; return; }
        if (part === "[/bud]") { inBud = false; return; }
        if (!part) return;
        const quiet = inSpec || inOpt || inBud || isOptLine || isBudLine;
        const bud = inBud || isBudLine;
        tokenizeStyled._defaults = {
          bold: !quiet,
          italic: inSpec,
          color: bud || inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : null,
        };
        const rawTokens = tokenizeStyled(part);
        tokenizeStyled._defaults = {};
        rawTokens.forEach((tok) => {
          tokens.push({
            ...tok,
            bold: quiet ? false : true,
            italic: inSpec ? true : !!tok.italic,
            color: bud || inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : tok.color,
            highlight: inReq || bud ? false : !!(tok.highlight || autoHl),
            size: inSpec || inOpt || isOptLine ? SPEC_SIZE : 8.5,
          });
        });
        if (!rawTokens.length) {
          tokens.push({
            text: part,
            bold: !quiet,
            italic: inSpec,
            color: bud || inReq ? [200, 0, 0] : inBlue ? AUTO_BLUE : null,
            highlight: inReq || bud ? false : autoHl,
            size: inSpec || inOpt || isOptLine ? SPEC_SIZE : 8.5,
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(50, 90, 165);
        const headerLines = doc.splitTextToSize(stripLeadMarks(block.text), Math.max(80, maxW));
        const headerCenter = descLeft + maxW / 2;
        headerLines.forEach((line) => {
          ensureSpace(tableLineHeight + 2);
          doc.text(line, headerCenter, y, { align: "center" });
          y += tableLineHeight + 1;
        });
        y += 2;
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

const font = await quotePdf.embedFont(StandardFonts.Helvetica);
const fontBold = await quotePdf.embedFont(StandardFonts.HelveticaBold);

// Signature on second-to-last page (NOTICE page) from quote number initials
{
  const pagesNow = quotePdf.getPages();
  if (pagesNow.length >= 2) {
    const signPage = pagesNow[pagesNow.length - 2];
    const qn = String(quote.quote_number || "").toUpperCase();
    const signerName = /(?:^|[^A-Z])RC(?:[^A-Z]|$)/.test(qn) ? "Rhiannon Canas" : "Hazel Caling";
    // Cover the printed "Hazel Caling" line, then write the matching name.
    signPage.drawRectangle({
      x: 34,
      y: 285.5,
      width: 160,
      height: 13,
      color: rgb(1, 1, 1),
    });
    signPage.drawText(signerName, {
      x: 36,
      y: 287.1,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }
}

// ========== PAGE NUMBERS (bottom right, bold current page) ==========
const totalPages = quotePdf.getPageCount();
const pages = quotePdf.getPages();

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
    const quoteNo = String(quote.quote_number || "quote").trim() || "quote";
    const projectName = String(quote.project || "").trim();
    const fileBase = !projectName || /^n\/a$/i.test(projectName) ? quoteNo : `${quoteNo} - ${projectName}`;
    a.download = `${fileBase.replace(/[\\/:*?"<>|]/g, "")}.pdf`;
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
    const dashColumnOptions = {
      sales: [...new Set([
        "Mike Llorence", "Phil Haas", "Luke Hanzlik", "Alex White", "Mark Labitad", "Rhiannon Canas", "Megan McCabe", "Hazel Caling",
        ...quotes.flatMap((q) => contactToArray(q.contact)),
      ])].sort(),
      customer: [...new Set(quotes.map((q) => String(q.to_company || "").trim()).filter(Boolean))].sort(),
      location: [...new Set(quotes.map((q) => String(q.location || "").trim()).filter(Boolean))].sort(),
      status: [...new Set([
        "Not Started", "In Progress", "Bid Submitted", "Bid Submitted - to Sales", "Not Bidding", "Won", "Lost", "Pending Instruction from Sales",
        ...quotes.map((q) => String(q.status || "").trim()).filter(Boolean),
      ])].sort(),
    };
    const visibleQuotes = quotes.filter((q) => {
      if (dashColumnFilters.sales && !contactToArray(q.contact).some((name) => name.toLowerCase() === dashColumnFilters.sales.toLowerCase())) return false;
      if (dashColumnFilters.customer && String(q.to_company || "").toLowerCase() !== dashColumnFilters.customer.toLowerCase()) return false;
      if (dashColumnFilters.location && String(q.location || "").toLowerCase() !== dashColumnFilters.location.toLowerCase()) return false;
      if (dashColumnFilters.status && String(q.status || "").toLowerCase() !== dashColumnFilters.status.toLowerCase()) return false;
      return true;
    });
    const pagedQuotes = visibleQuotes.slice(
  (dashPage - 1) * dashPageSize,
  dashPage * dashPageSize
);

const totalDashPages = Math.ceil(visibleQuotes.length / dashPageSize) || 1;

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
          {Object.values(dashColumnFilters).some(Boolean) && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, padding: "8px 10px 0" }}>
              <span style={{ color: "#475569", fontSize: 12 }}>
                {Object.entries(dashColumnFilters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ")}
              </span>
              <button
                type="button"
                className="btn secondary"
                style={{ width: "auto", padding: "4px 10px" }}
                onClick={() => {
                  setDashColumnFilters({ sales: "", customer: "", location: "", status: "" });
                  setDashColumnOpen("");
                  setDashColumnQuery("");
                  setDashPage(1);
                }}
              >
                Clear filter
              </button>
            </div>
          )}
          <table className="data-table">
            <thead>
              <tr>
                {[
                  ["sales", "Outside Sales"],
                  ["quote_number", "Quote #"],
                  ["bid_date", "Bid Due Date"],
                  ["created_at", "Created On"],
                  ["status", "Status"],
                  ["project", "Job"],
                  ["customer", "Customer"],
                  ["total", "Total"],
                  ["location", "Location"],
                ].map(([key, label]) => {
                  const canFilter = ["sales", "customer", "location", "status"].includes(key);
                  return (
                    <th key={key}>
                      {canFilter ? (
                        <div ref={dashColumnOpen === key ? dashColumnRef : null} style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDashColumnQuery("");
                              setDashColumnOpen((open) => open === key ? "" : key);
                            }}
                            style={{ border: 0, background: "transparent", fontWeight: 700, cursor: "pointer", color: dashColumnFilters[key] ? "#1d4ed8" : "inherit" }}
                          >
                            {label}{dashColumnFilters[key] ? `: ${dashColumnFilters[key]}` : " ▾"}
                          </button>
                          {dashColumnOpen === key && (
                            <div style={{ position: "absolute", zIndex: 20, left: 0, top: "100%", minWidth: 210, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, boxShadow: "0 8px 18px rgba(0,0,0,.12)" }}>
                              <input
                                autoFocus
                                placeholder={`Type ${label}`}
                                value={dashColumnQuery}
                                onChange={(e) => setDashColumnQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setDashColumnOpen("");
                                    setDashColumnQuery("");
                                  }
                                  if (e.key === "Enter") {
                                    const match = (dashColumnOptions[key] || []).find((value) => value.toLowerCase().includes(dashColumnQuery.trim().toLowerCase()));
                                    if (!match) return;
                                    setDashColumnFilters((prev) => ({ ...prev, [key]: match }));
                                    setDashColumnOpen("");
                                    setDashColumnQuery("");
                                    setDashPage(1);
                                  }
                                }}
                                style={{ width: "100%", boxSizing: "border-box", border: 0, borderBottom: "1px solid #e5e7eb", padding: "6px 8px" }}
                              />
                              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                                <button type="button" style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: "#fff", padding: "6px 8px" }} onClick={() => {
                                  setDashColumnFilters((prev) => ({ ...prev, [key]: "" }));
                                  setDashColumnOpen("");
                                  setDashColumnQuery("");
                                  setDashPage(1);
                                }}>All</button>
                                {(dashColumnOptions[key] || []).filter((value) => value.toLowerCase().includes(dashColumnQuery.trim().toLowerCase())).map((value) => (
                                  <button type="button" key={value} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderTop: "1px solid #eef1f4", background: dashColumnFilters[key] === value ? "#eef4fb" : "#fff", padding: "6px 8px" }} onClick={() => {
                                    setDashColumnFilters((prev) => ({ ...prev, [key]: value }));
                                    setDashColumnOpen("");
                                    setDashColumnQuery("");
                                    setDashPage(1);
                                  }}>{value}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : label}
                    </th>
                  );
                })}
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
  <style>{`
    .sales-picker { position: relative; }
    .sales-picker-box {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      min-height: 36px; width: 100%; text-align: left; background: #fff;
      border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px;
    }
    .sales-input {
      flex: 1; min-width: 90px; border: 0; outline: none; background: transparent;
      font-size: 13px; padding: 4px 2px;
    }
    .sales-empty { padding: 8px 10px; color: #64748b; font-size: 12px; }
    .sales-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: #eef4fb; color: #1e3a5f; border-radius: 12px;
      padding: 2px 4px 2px 8px; font-size: 12px; line-height: 1.2;
    }
    .sales-x {
      border: 0; background: transparent; color: #64748b; cursor: pointer;
      font-size: 14px; line-height: 1; padding: 0 4px;
    }
    .sales-x:hover { color: #b42318; }
    .sales-menu {
      position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
      background: #fff; border: 1px solid #cbd5e1; border-radius: 6px;
      max-height: 180px; overflow-y: auto; box-shadow: 0 8px 18px rgba(0,0,0,.12);
    }
    .sales-row {
      display: flex !important; flex-direction: row !important; align-items: center !important;
      gap: 8px; padding: 6px 10px; margin: 0; text-align: left; cursor: pointer;
    }
    .sales-row input { margin: 0; width: auto; flex: 0 0 auto; }
    .sales-row span { flex: 1; }
  `}</style>
  <div className="sales-picker" ref={outsideSalesRef}>
    <div className="sales-picker-box">
      {contactToArray(quoteForm.contact).map((name) => (
        <span key={name} className="sales-chip">
          {name}
          <button
            type="button"
            className="sales-x"
            title={"Remove " + name}
            onClick={() => {
              const current = contactToArray(quoteForm.contact).filter((x) => x !== name);
              setQuoteForm((prev) => ({ ...prev, contact: current }));
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="sales-input"
        placeholder={contactToArray(quoteForm.contact).length ? "" : "Type a name"}
        value={salesQuery}
        onFocus={() => setOutsideSalesOpen(true)}
        onChange={(e) => {
          setSalesQuery(e.target.value);
          setOutsideSalesOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const query = salesQuery.trim().toLowerCase();
            const match = outsideSalesNames.find((name) => name.toLowerCase().includes(query)) || salesQuery.trim();
            if (!match) return;
            const current = contactToArray(quoteForm.contact);
            if (!current.includes(match)) current.push(match);
            setQuoteForm((prev) => ({ ...prev, contact: current }));
            setSalesQuery("");
            setOutsideSalesOpen(false);
          }
        }}
      />
    </div>
    {outsideSalesOpen && (
      <div className="sales-menu">
        {outsideSalesNames
          .filter((name) => name.toLowerCase().includes(salesQuery.trim().toLowerCase()))
          .map((name) => (
            <label key={name} className="sales-row">
              <input
                type="checkbox"
                checked={contactToArray(quoteForm.contact).includes(name)}
                onChange={(e) => {
                  const current = contactToArray(quoteForm.contact);
                  if (e.target.checked) {
                    if (!current.includes(name)) current.push(name);
                  } else {
                    const index = current.indexOf(name);
                    if (index > -1) current.splice(index, 1);
                  }
                  setQuoteForm((prev) => ({ ...prev, contact: current }));
                }}
              />
              <span>{name}</span>
            </label>
          ))}
        {outsideSalesNames.filter((name) => name.toLowerCase().includes(salesQuery.trim().toLowerCase())).length === 0 && (
          <div className="sales-empty">No match. Press Enter to add this name.</div>
        )}
      </div>
    )}
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

    {(activeQuote || isCopyDraft) && (
      <div className="card table-wrap">
        <div className="line-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Line Items</h3>
          {(isCopyDraft ? draftCopiedLineItems : (activeQuote.line_items || [])).length === 0 && (
            <button className="btn primary" type="button" onClick={() => beginAddLine()}>
              Add Line Item
            </button>
          )}
        </div>


        <style>{`
          .line-toolbar { margin-bottom: 8px; }
          .line-edit-row { background: #f4fbf6; }
          .style-dots { display: flex; gap: 4px; margin-bottom: 4px; }
          .style-dots button { width: 22px; height: 22px; border: 1px solid #d5dbe2; background: #fff; border-radius: 4px; padding: 0; }
          .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
          .dot.hl { background: #ffe56a; }
          .dot.red { background: #e23b3b; }
          .dot.blue { background: #2f6fed; }
          .dot.green { background: #1f9d55; }
          .word-box { min-height: 54px; border: 1px solid #d0d7de; border-radius: 4px; padding: 6px; background: #fff; }
          .word-box mark { background: #ffe56a; }
          .search-box { width: 100%; min-height: 36px; max-height: 140px; resize: vertical; }
          .styled-cell mark, .word-box mark { background: #ffe56a; }
          .word-box .section, .description-cell .section { color: #325aa5; font-weight: 700; text-align: center; display: block; }
          .table-wrap, .line-items-table, .line-items-table tbody, .line-items-table tr, .line-items-table td { overflow: visible !important; }
          .line-items-table td { position: relative; vertical-align: top; }
          .line-items-table .lookup-results {
            position: absolute; z-index: 80; left: 0; top: calc(100% + 4px);
            width: 360px; max-height: 180px; overflow-y: auto;
            background: #fff; border: 1px solid #c5ced6; border-radius: 6px;
            box-shadow: 0 8px 18px rgba(0,0,0,.16);
          }
          .vendor-lookup { position: relative; }
          .vendor-results {
            position: absolute; z-index: 130; left: 0; top: calc(100% + 2px);
            width: 220px; max-height: 150px; overflow-y: auto; overflow-x: hidden;
            background: #fff; border: 1px solid #c5ced6; border-radius: 6px;
            box-shadow: 0 8px 18px rgba(0,0,0,.16);
          }
          .vendor-results button {
            display: block; width: 100%; text-align: left; background: #fff;
            border: 0; border-bottom: 1px solid #eef1f4; padding: 6px 8px;
            white-space: normal; font-size: 12px; line-height: 1.3;
          }
          .vendor-results button:hover { background: #f3f7fb; }
          .line-items-table .terms-col, .line-items-table .terms-select { min-width: 84px; }
          .line-items-table .terms-select {
            width: 84px; min-width: 84px; box-sizing: border-box; padding: 2px 4px;
          }
          .line-items-table .live-calc {
            white-space: nowrap; font-variant-numeric: tabular-nums;
            color: #16324f; font-weight: 600; padding-top: 8px;
          }
          .sales-picker { position: relative; }
          .sales-picker-box {
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            min-height: 36px; width: 100%; text-align: left; background: #fff;
            border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; cursor: pointer;
          }
          .sales-placeholder { color: #64748b; font-size: 13px; }
          .sales-chip {
            display: inline-flex; align-items: center; gap: 4px;
            background: #eef4fb; color: #1e3a5f; border-radius: 12px;
            padding: 2px 4px 2px 8px; font-size: 12px; line-height: 1.2;
          }
          .sales-x {
            border: 0; background: transparent; color: #64748b; cursor: pointer;
            font-size: 14px; line-height: 1; padding: 0 4px;
          }
          .sales-x:hover { color: #b42318; }
          .sales-menu {
            position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
            background: #fff; border: 1px solid #cbd5e1; border-radius: 6px;
            max-height: 180px; overflow-y: auto; box-shadow: 0 8px 18px rgba(0,0,0,.12);
          }
          .sales-row {
            display: flex; flex-direction: row; align-items: center; gap: 8px;
            padding: 6px 10px; margin: 0; text-align: left; cursor: pointer;
          }
          .sales-row input { margin: 0; flex: 0 0 auto; }
          .sales-row span { flex: 1; }
          .tag-cell .spec-size, .word-box .spec-size { font-size: 0.76em; font-weight: 400; }
          .tag-preview.option-line, .tag-preview.option-line .tag-option, .tag-cell .tag-option { font-weight: 400 !important; font-size: 0.78em; white-space: nowrap; }
          .tag-preview.budgetary-line, .tag-preview.budgetary-line .tag-budgetary, .tag-cell .tag-budgetary { font-weight: 400 !important; color: #c80000 !important; font-size: 0.86em; }
          .word-box.tag-box { min-height: 72px; max-height: 140px; overflow: auto; white-space: pre-wrap; }
          .row-actions { width: 118px; }
          .row-actions .act-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
          .row-actions .icon-btn {
            display: inline-flex; align-items: center; justify-content: center;
            height: 24px; padding: 0 6px; width: 100%;
            border-radius: 4px; border: 1px solid #d7dee6; background: #fff;
            color: #334155; font-size: 11px; font-weight: 600; line-height: 1; cursor: pointer;
          }
          .row-actions .icon-btn.add { color: #166534; border-color: #b7e0c2; background: #f3fbf6; }
          .row-actions .icon-btn.edit { color: #1d4ed8; border-color: #c9d7f5; background: #f5f8fd; }
          .row-actions .icon-btn.notes { color: #854d0e; border-color: #ead7ae; background: #fffaf1; }
          .row-actions .icon-btn.delete { color: #b42318; border-color: #f0c8c4; background: #fff6f5; }
          .row-actions .icon-btn.cancel { color: #475569; border-color: #d7dee6; background: #f8fafc; }
          .row-actions .icon-btn:hover { filter: brightness(0.97); }
          .row-actions .icon-btn:disabled { opacity: 0.55; cursor: default; }
          .col-resizer { position: absolute; top: 0; right: -3px; width: 8px; height: 100%; cursor: col-resize; }
          .line-items-table .lookup-results button {
            display: block; width: 100%; text-align: left; background: #fff;
            border: 0; border-bottom: 1px solid #eef1f4; padding: 7px 8px; white-space: normal;
          }
          .line-items-table .lookup-results button:hover { background: #f3f7fb; }
          .hit-title { display: block; font-weight: 700; }
          .hit-vendor { display: block; color: #334155; font-size: 12px; }
          .hit-desc { display: block; color: #64748b; font-size: 11px; }
          .style-note { margin: 4px 0; padding: 6px 8px; background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; border-radius: 4px; font-size: 12px; }
          .styled-cell.tag-cell { font-weight: 700; }
          .description-cell .bullet, .word-box .bullet { font-style: italic; } .description-cell .bullet.red, .word-box .bullet.red { color: #c80000; }
          .description-cell strong { font-weight: 700; }
        `}</style>
        <table className="line-items-table">
          <colgroup>
            <col style={{ width: 28 }} />
            <col style={{ width: tagColWidth }} />
            {editingLineItemId && <col style={{ width: 180 }} />}
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 88 }} />
            <col style={{ width: 64 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 64 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 124 }} />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th style={{ width: tagColWidth, position: "relative" }}>Tag<span className="col-resizer" onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = tagColWidth;
                const move = (ev) => setTagColWidth(Math.max(140, startW + ev.clientX - startX));
                const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }} /></th>
              {editingLineItemId && <th>Search</th>}
              <th>Vendor</th>
              <th>Description</th>
              <th>List</th>
              <th>Mult.</th>
              <th>Net</th>
              <th>Markup</th>
              <th>Startup</th>
              <th>Freight</th>
              <th className="terms-col">Terms</th>
              <th>Sell</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows = isCopyDraft ? draftCopiedLineItems : (activeQuote.line_items || []);
              const editor = (
                <tr className="line-edit-row" key="line-editor">
                  <td>≡</td>
                  <td>
                    <div className="style-dots">
                      <button type="button" title="Highlight" onClick={() => applyWordStyle("tag", "highlight")}><span className="dot hl" /></button>
                    </div>
                    <div
                      ref={tagRef}
                      className="word-box tag-box"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => syncStyledField("tag")}
                    />
                  </td>
                  <td>
                    <div className="lookup-field">
                    <textarea
                      className="search-box"
                      placeholder="Search item, model, part #, or description"
                      value={lineSearchText}
                      onChange={(e) => {
                        setLineSearchText(e.target.value);
                        searchLineProducts(e.target.value);
                      }}
                    />
                    {lineProductResults.length > 0 && (
                      <div className="lookup-results">
                        {lineProductResults.slice(0, 20).map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              selectLineProduct(p);
                              setLineSearchText("");
                              fillStyledFields(p.tag || lineItemForm.tag, p.description || "");
                            }}
                          >
                            <span className="hit-title">{[p.category || p.type, p.part_number, p.model].filter(Boolean).join(" | ") || p.name}</span>
                            <span className="hit-vendor">{p.vendor || p.manufacturer || ""}</span>
                            <span className="hit-desc">{String(p.description || "").slice(0, 110)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  </td>
                  <td>
                    <div className="vendor-lookup">
                      <input
                        placeholder="Vendor"
                        value={lineItemForm.vendor}
                        onChange={(e) => searchLineVendors(e.target.value)}
                      />
                      {lineVendorResults.length > 0 && (
                        <div className="vendor-results">
                          {lineVendorResults.slice(0, 20).map((c) => (
                            <button type="button" key={c.id} onClick={() => {
                              setLineItemForm((prev) => ({ ...prev, vendor: c.name }));
                              setLineVendorResults([]);
                            }}>{c.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="style-dots">
                      <button type="button" title="Header" onClick={() => applyWordStyle("description", "header")}>H</button>
                      <button type="button" title="Bold" onClick={() => applyWordStyle("description", "bold")}><b>B</b></button>
                      <button type="button" title="Italic" onClick={() => applyWordStyle("description", "italic")}><i>I</i></button>
                      <button type="button" title="Highlight" onClick={() => applyWordStyle("description", "highlight")}><span className="dot hl" /></button>
                      <button type="button" title="Red" onClick={() => applyWordStyle("description", "red")}><span className="dot red" /></button>
                      <button type="button" title="Clear" onClick={() => applyWordStyle("description", "clear")}>⌫</button>
                    </div>
                    <div
                      ref={descriptionRef}
                      className="word-box description-box"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => syncStyledField("description")}
                    />
                  </td>
                  <td><input name="list_price" value={lineItemForm.list_price} onChange={updateForm(setLineItemForm)} /></td>
                  <td><input name="multiplier" value={lineItemForm.multiplier} onChange={updateForm(setLineItemForm)} /></td>
                  <td className="live-calc">{money(calculatedPreview.net)}</td>
                  <td><input name="markup" value={lineItemForm.markup} onChange={updateForm(setLineItemForm)} /></td>
                  <td><input name="startup" value={lineItemForm.startup} onChange={updateForm(setLineItemForm)} /></td>
                  <td><input name="freight" value={lineItemForm.freight} onChange={updateForm(setLineItemForm)} /></td>
                  <td>
                    <select className="terms-select" name="terms" value={lineItemForm.terms} onChange={updateForm(setLineItemForm)}>
                      <option>FFA</option>
                      <option>FOB</option>
                    </select>
                  </td>
                  <td className="live-calc">{lineItemForm.included ? "Included" : money(calculatedPreview.sell)}</td>
                  <td><input name="qty" value={lineItemForm.qty} onChange={updateForm(setLineItemForm)} /></td>
                  <td className="live-calc">{lineItemForm.included ? "Included" : money(calculatedPreview.total)}</td>
                  <td><textarea name="notes" value={lineItemForm.notes} onChange={updateForm(setLineItemForm)} /></td>
                  <td className="row-actions">
                    <div className="act-grid">
                      <button className="icon-btn add" type="button" onClick={saveLineItem} disabled={lineItemBusy}>{lineItemBusy ? "Saving" : "Save"}</button>
                      <button className="icon-btn cancel" type="button" onClick={cancelLineEdit}>Cancel</button>
                    </div>
                  </td>
                </tr>
              );
              const out = [];
              rows.forEach((item, index) => {
                const open = editingLineItemId === item.id;
                if (open) {
                  out.push(editor);
                  return;
                }
                if (!open) {
                  out.push(
                    <tr key={item.id}>
                      <td draggable onDragStart={() => setDraggedLineItem(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropLineItem(item.id)} className="drag">☰</td>
                      <td className="styled-cell tag-cell" dangerouslySetInnerHTML={{ __html: pdfPreviewHtml(item.tag, "tag") }} />
                      {editingLineItemId && <td></td>}
                      <td>{item.vendor}</td>
                      <td className="styled-cell description-cell" dangerouslySetInnerHTML={{ __html: pdfPreviewHtml(getLineDescription(item), "description") }} />
                      <td>{money(item.list_price)}</td>
                      <td>{item.multiplier || ""}</td>
                      <td>{money(item.net_cost)}</td>
                      <td>{item.markup ? `${(Number(item.markup) * 100).toFixed(0)}%` : ""}</td>
                      <td>{money(item.startup)}</td>
                      <td>{money(item.freight)}</td>
                      <td>{item.terms || ""}</td>
                      <td>{item.included ? "Included" : money(item.sell_price)}</td>
                      <td>{item.qty}</td>
                      <td>{item.included ? "Included" : money(item.total_price)}</td>
                      <td>{item.notes}</td>
                      <td className="row-actions">
                        <div className="act-grid">
                          <button className="icon-btn add" type="button" title="Add a line under this one" onClick={() => beginAddLine(item.id)}>+ Add</button>
                          <button className="icon-btn edit" type="button" title="Edit this line" onClick={() => editLineItem(item)}>Edit</button>
                          {!["notes", "startup", "freight", "adders"].includes(String(item.item || "").toLowerCase()) && (
                            <button className="icon-btn notes" type="button" title="Line notes" onClick={() => openNotesModal(item)}>Notes</button>
                          )}
                          <button className="icon-btn delete" type="button" title="Delete this line" disabled={deletingLineItemId === item.id} onClick={() => {
                            if (isCopyDraft) setDraftCopiedLineItems((prev) => prev.filter((_, i) => i !== index));
                            else deleteLineItem(item.id);
                          }}>{deletingLineItemId === item.id ? "..." : "Delete"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (editingLineItemId === "new" && insertAfterId === item.id) out.push(editor);
              });
              if (editingLineItemId === "new" && !insertAfterId) out.push(editor);
              return out;
            })()}
          </tbody>
        </table>
        {(isCopyDraft ? draftCopiedLineItems : (activeQuote.line_items || [])).length === 0 && editingLineItemId !== "new" && (
          <p style={{ margin: "10px 0 0", color: "#64748b" }}>
            No line items yet. Click Add Line Item to add the first one.
          </p>
        )}
      </div>
    )}
  </div>
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
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              config.setSearch("");
              if (type === "products") fetchProducts("");
              else if (type === "notes") fetchNotes("");
              else if (type === "companies") fetchCompanies("");
              else fetchContacts("");
            }}
          >
            Clear
          </button>
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
//               <tr>{(config.displayFields || config.fields).slice(0, type === "products" ? 12 : 8).map((f) => <th key={f} style={f === "notes" ? { minWidth: 240 } : undefined}>{f === "list_price" ? "list" : f === "net_cost" ? "net" : f}</th>)}<th>Actions</th></tr>

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
        refresh: () => fetchProducts(productSearch, productFilters),
        endpoint: "products",
        form: productForm,
        setForm: setProductForm,
        empty: emptyProduct,
        editingId: editingProductId,
        setEditingId: setEditingProductId,
        rows: products,
        fields: ["name", "category", "type", "series", "model", "part_number", "description", "notes", "tag", "list_price", "multiplier", "surcharge", "vendor", "manufacturer", ],
        displayFields: ["name", "category", "type", "series", "model", "part_number", "description", "list_price", "multiplier", "net_cost", "notes", "vendor"],
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
    const productQuery = type === "products" ? String(config.search || "").trim().toLowerCase() : "";
    const visibleRows = type === "products"
      ? config.rows.filter((row) => {
          const filtersOk = ["category", "type", "series", "model", "vendor"].every((key) => {
            return !productFilters[key] || String(row[key] || "").toLowerCase() === productFilters[key].toLowerCase();
          });
          if (!filtersOk) return false;
          if (!productQuery) return true;
          return ["name", "part_number", "model", "description", "notes"].some((key) => String(row[key] || "").toLowerCase().includes(productQuery));
        })
      : config.rows;
    const totalItems = visibleRows.length;
    const totalPages = Math.ceil(totalItems / crudPageSize) || 1;
    const pagedRows = visibleRows.slice(
      (crudPage - 1) * crudPageSize,
      crudPage * crudPageSize
    );

    return (
      <section className="screen">
        <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
          <input
            placeholder={
              type === "products"
                ? "Search name, part number, model, description, or notes"
                : type === "notes"
                  ? "Search item, type, category, series, model, or note text"
                  : type === "companies"
                    ? "Search company name, type, or city"
                    : "Search name, email, role, or company"
            }
            value={config.search}
            onChange={(e) => config.setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn primary" type="button" onClick={config.refresh} style={{ width: "auto", flex: "0 0 auto" }}>Search</button>
          <button
            className="btn secondary"
            type="button"
            style={{ width: "auto", flex: "0 0 auto" }}
            onClick={() => {
              config.setSearch("");
              if (type === "products") {
                const cleared = { category: "", type: "", series: "", model: "", vendor: "" };
                setProductFilters(cleared);
                setProductFilterOpen("");
                fetchProducts("", cleared);
              }
              else if (type === "notes") fetchNotes("");
              else if (type === "companies") fetchCompanies("");
              else fetchContacts("");
            }}
          >
            Clear
          </button>
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
          {type === "products" && Object.values(productFilters).some(Boolean) && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, padding: "8px 10px 0" }}>
              <span style={{ color: "#475569", fontSize: 12 }}>
                {Object.entries(productFilters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" · ")}
              </span>
              <button
                type="button"
                className="btn secondary"
                style={{ width: "auto", padding: "4px 10px" }}
                onClick={() => {
                  setProductFilters({ category: "", type: "", series: "", model: "", vendor: "" });
                  setProductFilterOpen("");
                  setCrudPage(1);
                }}
              >
                Clear filter
              </button>
            </div>
          )}
          <table className="data-table">
            <thead>
              <tr>{(config.displayFields || config.fields).slice(0, type === "products" ? 12 : 8).map((f) => {
                const label = f === "list_price" ? "list" : f === "net_cost" ? "net" : f;
                const canFilter = type === "products" && ["category", "type", "series", "model", "vendor"].includes(f);
                return (
                  <th key={f} style={{ width: f === "notes" ? 160 : f === "description" ? 220 : undefined }}>
                    {canFilter ? (
                      <div ref={productFilterOpen === f ? productFilterRef : null} style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setProductFilterQuery("");
                            setProductFilterOpen((open) => open === f ? "" : f);
                          }}
                          style={{ border: 0, background: "transparent", fontWeight: 700, cursor: "pointer", color: productFilters[f] ? "#1d4ed8" : "inherit" }}
                        >
                          {label}{productFilters[f] ? `: ${productFilters[f]}` : " ▾"}
                        </button>
                        {productFilterOpen === f && (
                          <div style={{ position: "absolute", zIndex: 20, left: 0, top: "100%", minWidth: 200, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, boxShadow: "0 8px 18px rgba(0,0,0,.12)" }}>
                            <input
                              autoFocus
                              placeholder={`Type ${label}`}
                              value={productFilterQuery}
                              onChange={(e) => setProductFilterQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setProductFilterOpen("");
                                  setProductFilterQuery("");
                                }
                                if (e.key === "Enter") {
                                  const match = (productFilterOptions[f] || []).find((value) => value.toLowerCase().includes(productFilterQuery.trim().toLowerCase()));
                                  if (!match) return;
                                  setProductFilters({ ...productFilters, [f]: match });
                                  setProductFilterOpen("");
                                  setProductFilterQuery("");
                                  setCrudPage(1);
                                }
                              }}
                              style={{ width: "100%", boxSizing: "border-box", border: 0, borderBottom: "1px solid #e5e7eb", padding: "6px 8px" }}
                            />
                            <div style={{ maxHeight: 180, overflowY: "auto" }}>
                              <button type="button" style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: "#fff", padding: "6px 8px" }} onClick={() => {
                                const next = { ...productFilters, [f]: "" };
                                setProductFilters(next);
                                setProductFilterOpen("");
                                setProductFilterQuery("");
                                setCrudPage(1);
                              }}>All</button>
                              {(productFilterOptions[f] || []).filter((value) => value.toLowerCase().includes(productFilterQuery.trim().toLowerCase())).map((value) => (
                                <button type="button" key={value} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderTop: "1px solid #eef1f4", background: productFilters[f] === value ? "#eef4fb" : "#fff", padding: "6px 8px" }} onClick={() => {
                                  const next = { ...productFilters, [f]: value };
                                  setProductFilters(next);
                                  setProductFilterOpen("");
                                  setProductFilterQuery("");
                                  setCrudPage(1);
                                }}>{value}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : label}
                  </th>
                );
              })}<th>Actions</th></tr>
            </thead>
            <tbody>
  {pagedRows.map((row) => (
    <tr key={row.id}>
      {(config.displayFields || config.fields).slice(0, type === "products" ? 12 : 8).map((f) => (
        <td key={f} style={f === "notes" ? { width: 160, maxWidth: 180, whiteSpace: "normal" } : f === "description" ? { maxWidth: 240, whiteSpace: "normal" } : undefined}>{
          f === "net_cost"
            ? (Number(row.list_price || 0) * (1 + Number(row.surcharge || 0)) * Number(row.multiplier || 1)).toFixed(2)
            : f === "list_price"
              ? Number(row[f] || 0).toFixed(2)
              : String(row[f] ?? "")
        }</td>
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

