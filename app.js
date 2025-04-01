const DB_NAME = 'InvoiceDB';
const DB_VERSION = 6; // Increment from previous version
let db;
let currentInvoiceNumber = 0;

// ********************
// Database Initialization
// ********************
const initDB = () => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        
        // Create clients store
        if (!db.objectStoreNames.contains('clients')) {
            db.createObjectStore('clients', { 
                keyPath: 'id', 
                autoIncrement: true 
            });
        }

        // Create invoices store with orderId as key
        if (!db.objectStoreNames.contains('invoices')) {
            const store = db.createObjectStore('invoices', { 
                keyPath: 'orderId'
            });
            store.createIndex('byDate', 'date');
        }

        // Create counter store
        if (!db.objectStoreNames.contains('counter')) {
            const counterStore = db.createObjectStore('counter', { 
                keyPath: 'id' 
            });
            counterStore.add({ id: 'invoiceCounter', value: 0 });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadClients();
        setCurrentDate();
        initializeOrderId();
    };

    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        alert(`Database initialization failed: ${event.target.error.message}`);
    };
};

// ********************
// Order ID Management
// ********************
const initializeOrderId = () => {
    const transaction = db.transaction(['counter'], 'readwrite');
    const store = transaction.objectStore('counter');
    const request = store.get('invoiceCounter');

    request.onsuccess = (event) => {
        const data = event.target.result;
        if (!data) {
            store.add({ id: 'invoiceCounter', value: 0 });
        }
        currentInvoiceNumber = data ? data.value : 0;
        document.getElementById('invoiceNumber').value = 
            `BCMP-25-${(currentInvoiceNumber + 1).toString().padStart(4, '0')}`;
    };

    request.onerror = (event) => {
        console.error('Counter init error:', event.target.error);
        alert('Failed to initialize invoice counter');
    };
};

const generateOrderId = async () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['counter'], 'readwrite');
        const store = transaction.objectStore('counter');
        const request = store.get('invoiceCounter');

        request.onsuccess = (event) => {
            const data = event.target.result;
            currentInvoiceNumber = data ? data.value + 1 : 1;
            const orderId = `BCMP-25-${currentInvoiceNumber.toString().padStart(4, '0')}`;
            
            store.put({ id: 'invoiceCounter', value: currentInvoiceNumber })
                .onsuccess = () => resolve(orderId);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
};

// ********************
// Date Handling
// ********************
const setCurrentDate = () => {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).toUpperCase().replace(/ /g, '-');
    document.getElementById('invoiceDate').value = formattedDate;
};

// ********************
// Client Management
// ********************
let editingClientId = null;

const showClientModal = () => {
    document.getElementById('clientModal').style.display = 'block';
    loadClientList();
};

const closeClientModal = () => {
    document.getElementById('clientModal').style.display = 'none';
    clearClientForm();
};

const loadClientList = () => {
    const transaction = db.transaction(['clients'], 'readonly');
    const store = transaction.objectStore('clients');
    const request = store.getAll();

    request.onsuccess = (event) => {
        const clients = event.target.result;
        const clientList = document.getElementById('clientList');
        clientList.innerHTML = clients.map(client => `
            <div class="client-item">
                <span>${client.name}</span>
                <div>
                    <button class="btn-sm" onclick="editClient(${client.id})">Edit</button>
                    <button class="btn-sm btn-danger" onclick="deleteClient(${client.id})">Delete</button>
                </div>
            </div>
        `).join('');
    };
};

const loadClients = () => {
    const transaction = db.transaction(['clients'], 'readonly');
    const store = transaction.objectStore('clients');
    const request = store.getAll();

    request.onsuccess = (event) => {
        const clients = event.target.result;
        const select = document.getElementById('clientSelect');
        select.innerHTML = '<option value="">Select Client</option>';
        
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.name;
            select.appendChild(option);
        });
    };
};

const loadClientDetails = (clientId) => {
    const clientDetails = document.getElementById('clientDetails');
    clientDetails.innerHTML = clientId ? 'Loading...' : '';
    
    if (!clientId) return;

    const transaction = db.transaction(['clients'], 'readonly');
    const store = transaction.objectStore('clients');
    const request = store.get(Number(clientId));

    request.onsuccess = (event) => {
        const client = event.target.result;
        clientDetails.innerHTML = client ? `
            <p><strong>Address:</strong> ${client.address || 'N/A'}</p>
            <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
        ` : 'Client not found';
    };

    request.onerror = () => {
        clientDetails.innerHTML = 'Error loading client';
    };
};

const editClient = (id) => {
    const transaction = db.transaction(['clients'], 'readonly');
    const store = transaction.objectStore('clients');
    const request = store.get(id);

    request.onsuccess = (event) => {
        const client = event.target.result;
        editingClientId = client.id;
        document.getElementById('clientName').value = client.name;
        document.getElementById('clientAddress').value = client.address;
        document.getElementById('clientEmail').value = client.email;
        document.getElementById('clientPhone').value = client.phone;
        document.getElementById('formTitle').textContent = 'Edit Client';
    };
};

const deleteClient = (id) => {
    if (confirm('Are you sure you want to delete this client?')) {
        const transaction = db.transaction(['clients'], 'readwrite');
        const store = transaction.objectStore('clients');
        store.delete(id);
        loadClientList();
        loadClients();
    }
};

const saveClient = () => {
    const client = {
        name: document.getElementById('clientName').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        phone: document.getElementById('clientPhone').value.trim()
    };

    if (!client.name) {
        alert('Client name is required');
        return;
    }

    if (editingClientId) client.id = editingClientId;

    const transaction = db.transaction(['clients'], 'readwrite');
    const store = transaction.objectStore('clients');
    const request = editingClientId ? store.put(client) : store.add(client);

    request.onsuccess = () => {
        loadClientList();
        loadClients();
        clearClientForm();
        alert('Client saved successfully!');
    };

    request.onerror = (event) => {
        console.error('Error saving client:', event.target.error);
        alert('Error saving client. Please try again.');
    };
};

const clearClientForm = () => {
    document.getElementById('clientName').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('formTitle').textContent = 'Add New Client';
    editingClientId = null;
};

// ********************
// Invoice Items Management
// ********************
const addItemRow = () => {
    const tbody = document.getElementById('itemsBody');
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td><input type="text" class="item-desc" required></td>
        <td><input type="number" class="item-qty" min="0" step="1" required></td>
        <td><input type="number" class="item-price" min="0" step="0.01" required></td>
        <td class="item-total">0.00</td>
        <td><button class="btn-sm btn-danger" onclick="this.parentElement.parentElement.remove(); calculateTotal()">×</button></td>
    `;

    tbody.appendChild(row);
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', calculateTotal));
};

// ********************
// Calculations & PDF
// ********************
let totalDue = 0;

const calculateTotal = () => {
    totalDue = 0;
    document.querySelectorAll('#itemsBody tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const total = qty * price;
        row.querySelector('.item-total').textContent = total.toFixed(2);
        totalDue += total;
    });
    document.getElementById('totalDue').textContent = totalDue.toFixed(2);
};

const generatePDF = (orderId) => {
    const doc = new jspdf.jsPDF();
    const clientId = document.getElementById('clientSelect').value;
    const paymentDetails = document.getElementById('paymentDetails').value;

    const transaction = db.transaction(['clients'], 'readonly');
    const store = transaction.objectStore('clients');
    const request = store.get(Number(clientId));

    request.onsuccess = (event) => {
        const client = event.target.result;
        
        // Header Section
        doc.setFontSize(24);
        doc.setTextColor(46, 204, 113);
        doc.text("OrionLedger - Mark OL1", 20, 25);
        
        // Business Info
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text("Best Cuts Media Production", 20, 35);
        doc.setFont(undefined, 'normal');
        doc.text("264, SasthriNagar\nErode, TN\nIndia \n editor@bestcuts.in", 20, 40);

        // Invoice Details
        doc.text(`Invoice #: ${orderId}`, 160, 35);
        doc.text(`Date: ${document.getElementById('invoiceDate').value}`, 160, 40);

        // Client Info
        const clientInfo = [
            `Bill To: ${client.name}`,
            client.address,
            `Email: ${client.email}`,
            `Phone: ${client.phone}`
        ].filter(line => line.trim());
        
        doc.text(clientInfo, 20, 60);

        // Items Table
        const items = Array.from(document.querySelectorAll('#itemsBody tr')).map(row => ({
            description: row.querySelector('.item-desc').value,
            quantity: row.querySelector('.item-qty').value,
            price: parseFloat(row.querySelector('.item-price').value).toFixed(2),
            total: row.querySelector('.item-total').textContent
        }));

        doc.autoTable({
            startY: 90,
            head: [["Description", "Qty", "Unit Price", "Total"]],
            body: items.map(item => [item.description, item.quantity, item.price, item.total]),
            theme: 'plain',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 35 }
            }
        });

        // Total & Payment Details
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Due: ${document.getElementById('currency').value} ${totalDue.toFixed(2)}`, 20, finalY);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text("Payment Details:", 20, finalY + 10);
        doc.text(paymentDetails.split('\n'), 20, finalY + 15);

        // Save PDF
        const fileName = `${client.name.replace(/ /g,'_')}-${orderId}`;
        doc.save(`${fileName}.pdf`);
    };

    request.onerror = (event) => {
        console.error('Error loading client details:', event.target.error);
        alert('Error generating PDF: Client details not found');
    };
};

// ********************
// Invoice Saving
// ********************
const saveInvoice = async () => {
    if (!validateForm()) return;

    try {
        const orderId = await generateOrderId();
        const clientId = document.getElementById('clientSelect').value;
        
        if (!clientId) throw new Error('Please select a client');
        
        const invoice = {
            orderId: orderId, // This must match the keyPath
            date: document.getElementById('invoiceDate').value,
            clientId: clientId,
            items: Array.from(document.querySelectorAll('#itemsBody tr')).map(row => {
                // ... keep existing item validation ...
            }),
            totalDue: totalDue,
            currency: document.getElementById('currency').value,
            paymentDetails: document.getElementById('paymentDetails').value.trim()
        };

        // Add console log to verify invoice structure
        console.log('Saving invoice:', invoice);

        const transaction = db.transaction(['invoices'], 'readwrite');
        const store = transaction.objectStore('invoices');
        
        // Add error handler HERE
        transaction.onerror = (event) => {
            console.error('Transaction error:', event.target.error);
            alert(`Database Error: ${event.target.error.message}`);
        };

        // Add success handler
        transaction.oncomplete = () => {
            generatePDF(orderId);
            initializeOrderId();
        };

        // Add proper request handlers
        const request = store.add(invoice);
        
        request.onsuccess = () => {
            console.log('Invoice saved successfully');
            document.getElementById('invoiceNumber').value = orderId;
            generatePDF(orderId);
            initializeOrderId();
        };

        request.onerror = (event) => {
            console.error('Add error:', event.target.error);
            alert(`Failed to save invoice: ${event.target.error.message}`);
        };

    } catch (error) {
        console.error('Save error:', error);
        alert(`Error: ${error.message}`);
    }
};

// ********************
// Form Validation
// ********************
const validateForm = () => {
    try {
        // Check client selection
        if (!document.getElementById('clientSelect').value) {
            throw new Error('Please select a client');
        }

        // Check payment details
        if (!document.getElementById('paymentDetails').value.trim()) {
            throw new Error('Payment details are required');
        }

        // Check items
        const items = document.querySelectorAll('#itemsBody tr');
        if (items.length === 0) {
            throw new Error('Please add at least one item');
        }

        // Validate individual items
        items.forEach(row => {
            const desc = row.querySelector('.item-desc').value.trim();
            const qty = row.querySelector('.item-qty').value;
            const price = row.querySelector('.item-price').value;

            if (!desc) throw new Error('Item description cannot be empty');
            if (!qty || isNaN(qty)) throw new Error(`Invalid quantity: ${qty}`);
            if (!price || isNaN(price)) throw new Error(`Invalid price: ${price}`);
        });

        return true;
    } catch (error) {
        alert(error.message);
        return false;
    }
};

// ********************
// App Initialization
// ********************
document.getElementById('newInvoice').addEventListener('click', () => window.location.reload());
document.getElementById('manageClients').addEventListener('click', showClientModal);

// Initialize the app
initDB();
addItemRow();