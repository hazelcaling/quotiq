

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import "./App.css";
import hteLogo from "./assets/hte-logo.jpg";
import hteAddress from "./assets/hte-address.png";
import lastTwoPagesPdf from "./assets/last two page.pdf";

const API = "http://localhost:5000";

const emptyQuote = {
  bid_date: "N/A",
  contact: [],
  project: "",
  to_company: "",
  attention: "",
  location: "",
  status: "Not Started",
  notes: "",
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

  const [quotes, setQuotes] = useState([]);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [activeQuoteId, setActiveQuoteId] = useState(null);

  const [lineItemForm, setLineItemForm] = useState(emptyLineItem);
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
    fetchQuotes();
    fetchCompanies();
    fetchContacts();
    fetchProducts();
    fetchNotes();
  }, []);

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
  setDashPage(1);

  await fetchQuotes({
    search: dashSearch,
    line_search: dashLineSearch,
    status: dashStatus,
    customer: dashCustomer,
    location: dashLocation,
    quote_date_from: dashQuoteDateFrom,
    quote_date_to: dashQuoteDateTo,
    bid_date_from: dashBidDateFrom,
    bid_date_to: dashBidDateTo,
    sort_by: dashSort,
    direction: dashDirection,
  });
}

async function clearDashboardFilters() {
  setDashSearch("");
  setDashLineSearch("");
  setDashStatus("");
  setDashCustomer("");
  setDashLocation("");
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

  function handleQuoteContactInput(e) {
    const value = e.target.value;
    const arr = value.split(",").map((x) => x.trim()).filter(Boolean);
    setQuoteForm((prev) => ({ ...prev, contact: arr }));
  }

  // async function saveQuote(e) {
  //   e.preventDefault();
  //   if (editingQuoteId) {
  //     const res = await axios.put(`${API}/quotes/${editingQuoteId}`, quoteForm);
  //     setActiveQuoteId(res.data.id);
  //     setEditingQuoteId(null);
  //   } else {
  //     const res = await axios.post(`${API}/quotes`, quoteForm);
  //     setActiveQuoteId(res.data.id);
  //   }
  //   setQuoteForm(emptyQuote);
  //   await fetchQuotes();
  // }

//   async function saveQuote(e) {
//   e.preventDefault();

//   if (!isCopiedQuoteReadyToSave) return;
//   setQuoteBusy(true);
// setQuoteMessage(editingQuoteId ? "Updating quote..." : "Saving new quote...");

//   if (editingQuoteId) {
//     const res = await axios.put(`${API}/quotes/${editingQuoteId}`, quoteForm);
//     setActiveQuoteId(res.data.id);
//     setEditingQuoteId(null);
//   } else {
//     const res = await axios.post(`${API}/quotes`, quoteForm);
//     const newQuoteId = res.data.id;

//     for (const item of draftCopiedLineItems) {
//       await axios.post(`${API}/quotes/${newQuoteId}/line-items`, {
//         tag: item.tag || "",
//         vendor: item.vendor || "",
//         qty: item.qty || 1,
//         description: item.description || "",
//         item: item.item || "",
//         type: item.type || "",
//         series: item.series || "",
//         model: item.model || "",
//         part_number: item.part_number || "",
//         list_price: item.list_price || 0,
//         multiplier: item.multiplier || 1,
//         markup: item.markup || 0,
//         freight: item.freight || 0,
//         startup: item.startup || 0,
//         surcharge: item.surcharge || 0,
//         terms: item.terms || "FFA",
//         notes: item.notes || "",
//         included: item.included || false,
//       });
//     }

//     setActiveQuoteId(newQuoteId);
//     setDraftCopiedLineItems([]);
//     setCopiedQuote(null);
//     setShowCopiedRequired(false);
//   }

//   setQuoteForm(emptyQuote);
//   await fetchQuotes();
// }

async function saveQuote(e) {
  e.preventDefault();

  if (!isCopiedQuoteReadyToSave) return;

  setQuoteBusy(true);
  setQuoteMessage(editingQuoteId ? "Updating quote..." : "Saving new quote...");

  try {
    if (editingQuoteId) {
      const res = await axios.put(`${API}/quotes/${editingQuoteId}`, quoteForm);
      setActiveQuoteId(res.data.id);
      setEditingQuoteId(null);
      setQuoteMessage("Quote updated successfully.");
    } else {
      const res = await axios.post(`${API}/quotes`, quoteForm);
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
  } catch (err) {
    console.error(err);
    setQuoteMessage("Unable to save quote. Please try again.");
  } finally {
    setQuoteBusy(false);
    setTimeout(() => setQuoteMessage(""), 2500);
  }
}

  function editQuote(q) {
    setEditingQuoteId(q.id);
    setActiveQuoteId(q.id);

    setQuoteForm({
      bid_date: q.bid_date || "N/A",
      // contact: Array.isArray(q.contact) ? q.contact : [],
contact: contactToArray(q.contact || activeQuote?.contact),
      project: q.project || "",
      to_company: q.to_company || "",
      attention: q.attention || "",
      location: q.location || "",
      status: q.status || "Not Started",
      notes: q.notes || "",
      date: q.date || "",
    });
    navigate("/");
  }

  function clearQuoteForm() {
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

  // async function deleteQuote(id) {
  //   if (!confirm("Delete this quote?")) return;
  //   await axios.delete(`${API}/quotes/${id}`);
  //   if (activeQuoteId === id) setActiveQuoteId(null);
  //   await fetchQuotes();
  // }

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

  // async function saveLineItem(e) {
  //   e.preventDefault();
  //   if (!activeQuoteId) {
  //     // alert("Save or select a quote first.");
  //     return;
  //   }

  //   const payload = { ...lineItemForm };

  //   if (editingLineItemId) {
  //     await axios.put(`${API}/line-items/${editingLineItemId}`, payload);
  //     setEditingLineItemId(null);
  //   } else {
  //     await axios.post(`${API}/quotes/${activeQuoteId}/line-items`, payload);
  //   }

  //   setLineItemForm(emptyLineItem);
  //   await refreshActiveQuote();
  // }

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

  // async function deleteLineItem(id) {
  //   if (!confirm("Delete this line item?")) return;
  //   await axios.delete(`${API}/line-items/${id}`);
  //   await fetchQuotes();
  // }
//   async function deleteLineItem(id) {
//   if (!confirm("Delete this line item?")) return;

//   await axios.delete(`${API}/line-items/${id}`);
//   await refreshActiveQuote();
// }
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
    clean(item.category),
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

  const printQuotePdf = async (quote, mode = "preview") => {
    const doc = new jsPDF("p", "pt", "letter");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginLeft = 36;
    const marginRight = 36;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const totalPages = 3;

    // const pageHeader = () => {
    //   doc.addImage(hteLogo, "JPEG", marginLeft, 25, 120, 45);
    //   doc.addImage(hteAddress, "PNG", pageWidth - marginRight - 190, 25, 190, 45);
    // };
    const pageHeader = () => {
  doc.addImage(hteLogo, "JPEG", marginLeft, 20, 150, 55); // bigger logo
  // doc.addImage(hteAddress, "PNG", pageWidth - marginRight - 230, 20, 230, 55); // bigger address
  doc.addImage(hteAddress, "PNG", pageWidth - marginRight - 230, 38, 230, 55); // lower
};

    const pageFooter = (pageNum) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginRight, pageHeight - 20, {
        align: "right",
      });
    };

    const pdfQuoteTotal = quoteTotal(quote);

    const uniqueTerms = [
      ...new Set((quote.line_items || []).map((item) => item.terms).filter(Boolean)),
    ];

    const termsText =
      uniqueTerms.length === 1 ? `${uniqueTerms[0]} ORIGIN` : "TERMS VARY BY LINE ITEM";

    // PAGE 1
pageHeader();

const titleY = 110;
const topLineY = titleY - 18;
const bottomLineY = titleY + 8;

// doc.setDrawColor(47, 111, 99);
// doc.setLineWidth(1);
doc.setDrawColor(20, 80, 60); // darker green
doc.setLineWidth(2);          // thicker line
// doc.setDrawColor(15, 70, 50);
// doc.setLineWidth(2.5);

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
  1: { cellWidth: 180, },
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
  doc.setFont(
    "helvetica",
    options.style || "normal"
  );

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

// normal intro
addParagraph(
  "We are pleased to propose the following equipment for your consideration and subject to the engineer’s approval. Our proposal is limited only to that portion of the specifications concerning the equipment we have proposed per the sections and related paragraphs cited in our proposal. On all Heat Transfer Equipment Company’s quotations, where project plans and/or specifications have not been provided, we reserve the right to re-quote once the missing plans are provided to us."
);

// BOLD pricing paragraph
addParagraph(
  "Pricing is based upon the purchase of ALL equipment, per each manufacturer, on this quotation. If all equipment will not be ordered in full, price is subject to change. It is to not be assumed that any equipment or components, not explicitly written into this quote, even if they are within our scope, are included in the pricing of this quotation. Please discuss with your sales associate if any item is in question.",
  { style: "bold" }
);

// BOLD terms paragraph
addParagraph(
  "This quotation is in accordance with the Terms & Conditions listed at the end of this document – H.T.E. does not agree to accept other Terms & Conditions unless noted within this quotation.",
  { style: "bold" }
);

   // RED BOLD ITALIC tariff
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
y += 10;

doc.setTextColor(0, 0, 0);

doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.text(
  "NO SPECIFICATIONS PROVIDED",
  pageWidth / 2,
  y,
  { align: "center" }
);

y += 12;

autoTable(doc, {
  startY: y,
  margin: { left: marginLeft - 10, right: marginRight -10 },
  // theme: "grid",
  theme: "plain",
  head: [["TAG:", "QTY:", "DESCRIPTION:", "NET EACH", "EXT. TOTAL"]],
body: [...(quote.line_items || [])]
  .map((item) => [
  item.tag || "",
  Number(item.qty) > 0 ? item.qty : "",
  (item.description || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(^|\n)-\s+/g, "$1• ")
    .trim(),
  // formatMoney(item.sell_price),
  // formatMoney(item.total_price),
item.included ? "Included" : formatMoney(item.sell_price),
item.included ? "Included" : formatMoney(item.total_price),
]),
    

  styles: {
    font: "helvetica",
    fontSize: 8,
    cellPadding: { top: 8, bottom: 8, left: 4, right: 4 },
    textColor: [0, 0, 0],
    lineColor: [0, 0, 0],
    halign: "left",
    // lineWidth: 0.4,
  },
  headStyles: {
    fillColor: [230, 230, 230],
    textColor: [0, 0, 0],
    fontStyle: "bold",
    halign: "center",
  },
  columnStyles: {
    // 0: { cellWidth: 80 },
    0: { cellWidth: 85, cellPadding: { left: 10, right: 4, top: 8, bottom: 8 }, fontStyle: "bold" },
    1: { cellWidth: 40, halign: "center", fontStyle: "bold" },
    2: { cellWidth: 295, halign: "left" },
    3: { cellWidth: 70, halign: "center" },
    4: { cellWidth: 70, halign: "center", fontStyle: "bold" },
  },
  bodyStyles: {
    valign: "top",
  },

//   didParseCell: function (data) {

    
//   // DESCRIPTION column only
//   if (data.section === "body" && data.column.index === 2) {
//     const text = Array.isArray(data.cell.text)
//       ? data.cell.text.join(" ")
//       : String(data.cell.text || "");

//     // if contains bullet
//     if (text.includes("•")) {
//       data.cell.styles.fontStyle = "italic";
//     }
//   }
// },

// didParseCell: function (data) {
//   if (data.section === "body" && data.column.index === 2) {
//     const raw = String(data.row.raw[2] || "");

//     if (raw.includes("||")) {
//       // hide original text so custom text does not print twice
//       data.cell.styles.textColor = [255, 255, 255];
//     } else if (raw.includes("•")) {
//       // fallback: italicize full cell if no custom bold separator
//       data.cell.styles.fontStyle = "italic";
//     }
//   }
// },

didParseCell: function (data) {

  // reset every cell to normal first
  // data.cell.styles.fontStyle = "normal";

  // TAG column - hide only marked lines from autoTable
  if (data.section === "body" && data.column.index === 0) {
    const raw = String(data.cell.raw || "");

    data.cell.text = raw
      .split("\n")
      .map((line) => {
        // if (line.trim().startsWith("!")) return " ";
        // return line.trim();
        return line.replace("!", "").trim();
      });
  }

  // DESCRIPTION column
// DESCRIPTION column
if (data.section === "body" && data.column.index === 2) {
  const raw = String(data.cell.raw || "");

  if (raw.includes("||")) {
    data.cell.text = data.cell.text.map((line) =>
      String(line).replace(/\|\|/g, "")
    );
  }

  data.cell.text = data.cell.text.map((line) => {
  if (String(line).trim().startsWith("•")) {
    return "   " + line;
  }
  return line;
});

}
},

// didDrawCell: function (data) {


//   // TAG column - yellow + bold only line with *

//   if (
//   data.section === "body" &&
//   data.column.index === 0 &&
//   data.cell.raw !== undefined &&
//   data.cell.raw !== null
// ) {
//     const raw = String(data.row.raw[0] || "");
//     const lines = raw.split("\n");

//     const x = data.cell.x + 10;
//     let y = data.cell.y + 11;
//     const lineHeight = 8.5;

//     lines.forEach((line) => {
//       const isMarked = line.trim().startsWith("!");
//       const cleanLine = line.replace(/^\!/, "").trim();

//       if (isMarked && cleanLine) {
//         doc.setFont("helvetica", "bold");
//         doc.setFontSize(8);

//         const textWidth = doc.getTextWidth(cleanLine);

//         doc.setFillColor(255, 255, 0);
//         doc.rect(x - 1, y - 6, textWidth + 3, 8, "F");

//         doc.setTextColor(0, 0, 0);
//         doc.text(cleanLine, x, y);
//       }

//       y += lineHeight;
//     });
//   }

  
  

// //   if (data.section !== "body") return;
// //   if (data.column.index !== 2) return;

// //   // ✅ Do not custom-draw repeated/continued rows on new page
// // if (data.cell.raw === undefined || data.cell.raw === null) return;

// //   const raw = String(data.row.raw[2] || "");
// //   if (!raw.includes("||")) return;

// //   const [boldPart, ...restParts] = raw.split("||");
// //   const boldText = boldPart.trim();
// //   const normalText = restParts.join("||").trim();

// //   const x = data.cell.x + 3;
// //   let y = data.cell.y + 8;
// //   const maxWidth = data.cell.width - 6;
// //   const lineHeight = 8.5;

// //   doc.setTextColor(0, 0, 0);

// //   doc.setFont("helvetica", "bold");
// //   doc.text(boldText, x, y);

// //   const boldWidth = doc.getTextWidth(boldText + " ");

// //   doc.setFont("helvetica", "normal");

// //   const normalLines = doc.splitTextToSize(normalText, maxWidth - boldWidth);

// //   if (normalLines.length > 0) {
// //     doc.text(normalLines[0], x + boldWidth, y);
// //   }

// //   y += lineHeight;

//   // const remainingText = normalLines.slice(1).join(" ");
//   // const remainingLines = doc.splitTextToSize(remainingText, maxWidth);

//   // remainingLines.forEach((line) => {
//   //   const trimmed = line.trim();

//   //   if (trimmed.startsWith("•")) {
//   //     doc.setFont("helvetica", "italic");
//   //   } else {
//   //     doc.setFont("helvetica", "normal");
//   //   }

//   //   doc.text(line, x, y);
//   //   y += lineHeight;
//   // });
// // },

  

});

    y = doc.lastAutoTable.finalY + 18;

    y = doc.lastAutoTable.finalY + 6;

doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.7);
doc.line(marginLeft - 10, y, pageWidth - marginRight + 10, y);

y += 16;

doc.setFont("helvetica", "bold");
doc.setFontSize(8);

const priceNote1 = "PRICING DOES NOT INCLUDE SALES TAX";
const priceNote2 = `ALL EQUIPMENT HAS BEEN PRICED: ${termsText}`;

const drawHighlightedText = (text, yPos) => {
  const textWidth = doc.getTextWidth(text);
  const padding = 3;

  const x = pageWidth - marginRight - textWidth;

  // tight yellow highlight
  doc.setFillColor(255, 255, 0);
  doc.rect(
    x - padding,
    yPos - 6,
    textWidth + padding * 2,
    10,
    "F"
  );

  doc.setTextColor(0, 0, 0);
  doc.text(text, pageWidth - marginRight, yPos, { align: "right" });
};

// draw lines
drawHighlightedText(priceNote1, y);

y += 12;

drawHighlightedText(priceNote2, y);

y += 18;

doc.setFont("helvetica", "bold");
doc.setFontSize(12); // bigger

doc.text(`TOTAL: ${formatMoney(pdfQuoteTotal)}`, pageWidth - marginRight, y, {
  align: "right",
});

    // pageFooter(1);

   
    // pageFooter(2);


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

  }

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
    return (
      <section className="screen">
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
    <option>Not Bidding</option>
    <option>Won</option>
    <option>Lost</option>
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
                <th>Quote #</th>
                <th>Bid Due Date</th>
                <th>Created On</th>
                <th>Status</th>
                <th>Job</th>
                <th>Customer</th>
                <th>Attn</th>
                <th>Total</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedQuotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.quote_number}</td>
                  <td>{q.bid_date}</td>
                  <td>{q.created_at || q.date}</td>
                  <td><span className="pill">{q.status}</span></td>
                  <td>{q.project}</td>
                  <td>{q.to_company}</td>
                  <td>{q.attention}</td>
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
                    <button className="btn edit" onClick={() => editQuote(q)}>Edit</button>
                    {/* <button className="btn delete" onClick={() => deleteQuote(q.id)}>Delete</button> */}
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

        {/* <label>
          Outside Sales Contact(s)
          <input
            placeholder="Contacts, comma separated"
            value={formatContact(quoteForm.contact)}
            onChange={handleQuoteContactInput}
          />
        </label> */}

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
  Quote Date
  <input
    type="date"
    name="date"
    value={quoteForm.date || ""}
    onChange={updateForm(setQuoteForm)}
  />
</label>

        <label>
          Bid Due Date
          <input
            name="bid_date"
            placeholder="Bid Due Date"
            value={quoteForm.bid_date}
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
            <option>In Progress</option>
            <option>Bid Submitted</option>
            <option>Not Bidding</option>
            <option>Won</option>
            <option>Lost</option>
          </select>
        </label>

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
    New Quote / Clear Form
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
    <b>Quote#:</b> {activeQuote.quote_number}
  </p>

  <p>
    <b>Project:</b> {activeQuote.project || "-"}
  </p>

  <p>
    <b>Customer:</b> {activeQuote.to_company || "-"}
  </p>

  <p>
    <b>Attn To:</b> {activeQuote.attention || "-"}
  </p>

  <p>
    <b>Sales:</b> {formatContact(activeQuote.contact)}
  </p>

  <p>
    <b>Total:</b> {money(activeQuote.total)}
  </p>

  <div className="button-row">
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

    {/* <form className="card line-grid" onSubmit={saveLineItem}>
      <h3>Line Item {activeQuote ? `for ${activeQuote.quote_number}` : ""}</h3> */}
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
        <textarea
          className="tag-textarea"
          name="tag"
          placeholder="Tag"
          value={lineItemForm.tag}
          onChange={updateForm(setLineItemForm)}
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
                  <strong>{p.model || p.part_number || p.name}</strong>
                  <span>
                    {p.vendor || ""} {p.series || ""}
                  </span>
                  <small>{p.description || ""}</small>
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
        <textarea
          className="description-box"
          name="description"
          placeholder="Description"
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
        <input
          name="notes"
          placeholder="Notes"
          value={lineItemForm.notes}
          onChange={updateForm(setLineItemForm)}
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

      <button className="btn primary">
        {editingLineItemId ? "Update Line Item" : "Add Line Item"}
      </button>
    </form>
    </div>

    {(activeQuote || isCopyDraft) && (
      <div className="card table-wrap">
        <h3>Line Items</h3>

        <table className="line-items-table">
          <thead>
            <tr>
              <th></th>
              <th>Tag</th>
              <th>Item</th>
              <th>Vendor</th>
              <th>Qty</th>
              <th>Description</th>
              <th>List</th>
              <th>Surcharge</th>
              <th>Multiplier</th>
              <th>Net</th>
              <th>Markup</th>
              <th>Freight</th>
              <th>Startup</th>
              <th>Terms</th>
              <th>Sell</th>
              <th>Total</th>
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

                <td>{item.tag}</td>
                <td>{item.item}</td>
                <td>{item.vendor}</td>
                <td>{item.qty}</td>

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

                <td>{money(item.freight)}</td>
                <td>{money(item.startup)}</td>
                <td>{item.terms || ""}</td>
                <td>{item.included ? "Included" : money(item.sell_price)}</td>
                <td>{item.included ? "Included" : money(item.total_price)}</td>

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
        fields: ["name", "tag", "vendor", "manufacturer", "category", "type", "series", "model", "part_number", "description", "list_price", "multiplier", "surcharge", "notes"],
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
        fields: ["name", "type", "address1", "address2", "city", "state", "zipcode", "website", "account_number", "payment_terms", "notes"],
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
        fields: ["company_id", "first_name", "last_name", "role", "email", "tel", "mobile", "notes"],
      },
    }[type];

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
          {config.fields.filter((f) => !(type === "contacts" && f === "company_id")).map((field) =>
            field === "description" || field === "notes" || field === "text" ? (
              <textarea key={field} name={field} placeholder={field} value={config.form[field] || ""} onChange={updateForm(config.setForm)} />
            ) : field === "note_type" ? (
              <select key={field} name={field} value={config.form[field] || "standard"} onChange={updateForm(config.setForm)}>
                <option value="standard">standard</option>
                <option value="additional">additional</option>
                <option value="exception">exception</option>
                <option value="internal">internal</option>
              </select>
            ) : (
              // <input key={field} name={field} placeholder={field} value={config.form[field] || ""} onChange={updateForm(config.setForm)} />
<input
  key={field}
  name={field}
  placeholder={
    type === "products" || type === "notes"
      ? ({
          name: "Product Name e.g. Non-Condensing Hydronic Heating Boiler",
          category: "Category e.g. Boiler, Pump, Tank, Startup, Notes, Freight, Adders", 
          type: "Type e.g. Condensing, End Suction, Storage Tank",
        }[field] || field)
      : field
  }
  value={config.form[field] || ""}
  onChange={updateForm(config.setForm)}
/>
            )
          )}
          <button className="btn primary">{config.editingId ? "Update" : "Add"}</button>
          {config.editingId && <button type="button" className="btn secondary" onClick={() => { config.setEditingId(null); config.setForm(config.empty); }}>Cancel</button>}
        </form>

        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>{config.fields.slice(0, 8).map((f) => <th key={f}>{f}</th>)}<th>Actions</th></tr>
            </thead>
            <tbody>
              {config.rows.map((row) => (
                <tr key={row.id}>
                  {config.fields.slice(0, 8).map((f) => <td key={f}>{String(row[f] ?? "")}</td>)}
                  <td>
                    <button className="btn edit" onClick={() => { config.setEditingId(row.id); config.setForm({ ...config.empty, ...row }); }}>Edit</button>
                    <button className="btn delete" onClick={() => deleteCrud(config.endpoint, row.id, config.refresh)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

