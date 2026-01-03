#!/usr/bin/env python3
"""
Backend API Testing for Dynamic Web App Configurator
Tests all major endpoints and functionality
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class DynamicWebAppTester:
    def __init__(self, base_url="https://dynashop-editor.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.super_admin_token = None
        self.store_admin_token = None
        self.end_user_token = None
        self.test_store_id = None
        self.test_product_id = None
        self.test_address_id = None
        self.test_plan_id = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        elif self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
            
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                except:
                    error_detail = response.text[:200]
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'error': error_detail
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'expected': expected_status,
                'actual': 'Exception',
                'error': str(e)
            })
            return False, {}

    def test_super_admin_login(self):
        """Test super admin login"""
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@admin.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            self.token = self.super_admin_token
            return True
        return False

    def test_create_store(self):
        """Test store creation by super admin"""
        store_data = {
            "name": f"Test Store {uuid.uuid4().hex[:8]}",
            "description": "Test jewelry store",
            "currency": "INR",
            "contact_email": "test@store.com",
            "contact_phone": "+91-9876543210",
            "address": "123 Test Street, Test City"
        }
        success, response = self.run_test(
            "Create Store",
            "POST",
            "stores",
            200,
            data=store_data,
            token=self.super_admin_token
        )
        if success and 'id' in response:
            self.test_store_id = response['id']
            return True
        return False

    def test_create_store_admin(self):
        """Test creating store admin user"""
        if not self.test_store_id:
            return False
            
        user_data = {
            "name": "Test Store Admin",
            "email": f"admin{uuid.uuid4().hex[:8]}@test.com",
            "password": "password123",
            "role": "store_admin",
            "store_id": self.test_store_id
        }
        success, response = self.run_test(
            "Create Store Admin",
            "POST",
            "users",
            200,
            data=user_data,
            token=self.super_admin_token
        )
        if success:
            # Login as store admin
            login_success, login_response = self.run_test(
                "Store Admin Login",
                "POST",
                "auth/login",
                200,
                data={"email": user_data["email"], "password": user_data["password"]}
            )
            if login_success and 'access_token' in login_response:
                self.store_admin_token = login_response['access_token']
                return True
        return False

    def test_create_end_user(self):
        """Test creating end user"""
        user_data = {
            "name": "Test Customer",
            "email": f"customer{uuid.uuid4().hex[:8]}@test.com",
            "password": "password123",
            "role": "end_user"
        }
        success, response = self.run_test(
            "Register End User",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        if success and 'access_token' in response:
            self.end_user_token = response['access_token']
            return True
        return False

    def test_product_management(self):
        """Test product CRUD operations"""
        if not self.test_store_id or not self.store_admin_token:
            return False

        # Create product
        product_data = {
            "name": "Test Gold Ring",
            "description": "Beautiful 22K gold ring",
            "price": 25000.00,
            "category": "Rings",
            "sku": f"RING{uuid.uuid4().hex[:8]}",
            "weight": 5.5,
            "metal_type": "gold",
            "is_active": True
        }
        success, response = self.run_test(
            "Create Product",
            "POST",
            f"stores/{self.test_store_id}/products",
            200,
            data=product_data,
            token=self.store_admin_token
        )
        if success and 'id' in response:
            self.test_product_id = response['id']
            
            # Get products
            self.run_test(
                "Get Products",
                "GET",
                f"stores/{self.test_store_id}/products",
                200,
                token=self.store_admin_token
            )
            
            # Update product
            updated_data = {**product_data, "price": 26000.00}
            self.run_test(
                "Update Product",
                "PUT",
                f"stores/{self.test_store_id}/products/{self.test_product_id}",
                200,
                data=updated_data,
                token=self.store_admin_token
            )
            return True
        return False

    def test_inventory_management(self):
        """Test inventory operations"""
        if not self.test_store_id or not self.test_product_id or not self.store_admin_token:
            return False

        inventory_data = {
            "product_id": self.test_product_id,
            "quantity": 10,
            "min_stock_level": 2,
            "location": "Shelf A1"
        }
        success, response = self.run_test(
            "Create Inventory",
            "POST",
            f"stores/{self.test_store_id}/inventory",
            200,
            data=inventory_data,
            token=self.store_admin_token
        )
        if success:
            self.run_test(
                "Get Inventory",
                "GET",
                f"stores/{self.test_store_id}/inventory",
                200,
                token=self.store_admin_token
            )
            return True
        return False

    def test_subscription_plans(self):
        """Test subscription plan management"""
        if not self.test_store_id or not self.store_admin_token:
            return False

        plan_data = {
            "name": "Gold Flexi Plan",
            "plan_type": "gold_flexi",
            "duration_months": 11,
            "monthly_amount": 5000.00,
            "bonus_percentage": 10.0,
            "benefits": ["Zero making charges", "Flexible redemption"],
            "description": "Flexible gold savings plan",
            "is_active": True
        }
        success, response = self.run_test(
            "Create Subscription Plan",
            "POST",
            f"stores/{self.test_store_id}/subscription-plans",
            200,
            data=plan_data,
            token=self.store_admin_token
        )
        if success and 'id' in response:
            self.test_plan_id = response['id']
            
            # Get plans
            self.run_test(
                "Get Subscription Plans",
                "GET",
                f"stores/{self.test_store_id}/subscription-plans",
                200
            )
            return True
        return False

    def test_address_management(self):
        """Test address management for end users"""
        if not self.end_user_token:
            return False

        address_data = {
            "label": "Home",
            "full_name": "Test Customer",
            "phone": "+91-9876543210",
            "address_line1": "123 Test Street",
            "address_line2": "Near Test Mall",
            "city": "Test City",
            "state": "Test State",
            "postal_code": "123456",
            "country": "India",
            "is_default": True
        }
        success, response = self.run_test(
            "Create Address",
            "POST",
            "addresses",
            200,
            data=address_data,
            token=self.end_user_token
        )
        if success and 'id' in response:
            self.test_address_id = response['id']
            
            # Get addresses
            self.run_test(
                "Get Addresses",
                "GET",
                "addresses",
                200,
                token=self.end_user_token
            )
            return True
        return False

    def test_order_flow(self):
        """Test order creation and management"""
        if not all([self.test_store_id, self.test_product_id, self.test_address_id, self.end_user_token]):
            return False

        order_data = {
            "items": [{
                "product_id": self.test_product_id,
                "quantity": 1,
                "price": 25000.00
            }],
            "shipping_address_id": self.test_address_id,
            "notes": "Test order"
        }
        success, response = self.run_test(
            "Create Order",
            "POST",
            f"stores/{self.test_store_id}/orders",
            200,
            data=order_data,
            token=self.end_user_token
        )
        if success and 'id' in response:
            order_id = response['id']
            
            # Get orders as customer
            self.run_test(
                "Get My Orders",
                "GET",
                "my-orders",
                200,
                token=self.end_user_token
            )
            
            # Get orders as store admin
            self.run_test(
                "Get Store Orders",
                "GET",
                f"stores/{self.test_store_id}/orders",
                200,
                token=self.store_admin_token
            )
            
            # Update order status
            self.run_test(
                "Update Order Status",
                "PUT",
                f"stores/{self.test_store_id}/orders/{order_id}/status",
                200,
                data={"status": "processing", "tracking_number": "TRK123456"},
                token=self.store_admin_token
            )
            return True
        return False

    def test_subscription_flow(self):
        """Test subscription creation"""
        if not all([self.test_store_id, self.test_plan_id, self.end_user_token]):
            return False

        subscription_data = {
            "plan_id": self.test_plan_id,
            "payment_type": "value",
            "monthly_amount": 5000.00
        }
        success, response = self.run_test(
            "Subscribe to Plan",
            "POST",
            f"stores/{self.test_store_id}/subscribe",
            200,
            data=subscription_data,
            token=self.end_user_token
        )
        if success:
            # Get my subscriptions
            self.run_test(
                "Get My Subscriptions",
                "GET",
                "my-subscriptions",
                200,
                token=self.end_user_token
            )
            return True
        return False

    def test_mock_payment_flow(self):
        """Test mock payment system"""
        if not self.end_user_token:
            return False

        payment_data = {
            "amount": 5000.00,
            "description": "Test payment for subscription"
        }
        success, response = self.run_test(
            "Create Payment Order",
            "POST",
            "payments/create-order",
            200,
            data=payment_data,
            token=self.end_user_token
        )
        if success and 'id' in response:
            payment_id = response['id']
            
            # Complete payment
            self.run_test(
                "Complete Payment",
                "POST",
                f"payments/{payment_id}/complete",
                200,
                token=self.end_user_token
            )
            return True
        return False

    def test_page_editor_apis(self):
        """Test page editor functionality"""
        if not self.test_store_id or not self.store_admin_token:
            return False

        # Get page configs
        self.run_test(
            "Get Page Configs",
            "GET",
            f"stores/{self.test_store_id}/page-config",
            200,
            token=self.store_admin_token
        )

        # Create page config
        page_data = {
            "page_name": "test-page",
            "components": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "header",
                    "props": {"title": "Test Store"},
                    "order": 0
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "hero",
                    "props": {"title": "Welcome", "subtitle": "Test subtitle"},
                    "order": 1
                }
            ],
            "is_published": False
        }
        success, response = self.run_test(
            "Create Page Config",
            "POST",
            f"stores/{self.test_store_id}/page-config",
            200,
            data=page_data,
            token=self.store_admin_token
        )
        return success

    def test_vendor_and_po_management(self):
        """Test vendor and purchase order management"""
        if not self.test_store_id or not self.store_admin_token:
            return False

        # Create vendor
        vendor_data = {
            "name": "Test Vendor Ltd",
            "contact_name": "John Vendor",
            "email": "vendor@test.com",
            "phone": "+91-9876543210",
            "address": "Vendor Address",
            "gst_number": "GST123456789"
        }
        success, response = self.run_test(
            "Create Vendor",
            "POST",
            f"stores/{self.test_store_id}/vendors",
            200,
            data=vendor_data,
            token=self.store_admin_token
        )
        if success and 'id' in response:
            vendor_id = response['id']
            
            # Get vendors
            self.run_test(
                "Get Vendors",
                "GET",
                f"stores/{self.test_store_id}/vendors",
                200,
                token=self.store_admin_token
            )
            
            # Create purchase order
            if self.test_product_id:
                po_data = {
                    "vendor_id": vendor_id,
                    "items": [{
                        "product_id": self.test_product_id,
                        "quantity": 5,
                        "unit_price": 20000.00
                    }],
                    "notes": "Test purchase order"
                }
                self.run_test(
                    "Create Purchase Order",
                    "POST",
                    f"stores/{self.test_store_id}/purchase-orders",
                    200,
                    data=po_data,
                    token=self.store_admin_token
                )
            return True
        return False

    def test_pos_transactions(self):
        """Test POS transaction functionality"""
        if not all([self.test_store_id, self.test_product_id, self.store_admin_token]):
            return False

        pos_data = {
            "items": [{
                "product_id": self.test_product_id,
                "quantity": 1,
                "price": 25000.00
            }],
            "payment_method": "cash",
            "customer_name": "Walk-in Customer",
            "customer_phone": "+91-9876543210"
        }
        success, response = self.run_test(
            "Create POS Transaction",
            "POST",
            f"stores/{self.test_store_id}/pos-transactions",
            200,
            data=pos_data,
            token=self.store_admin_token
        )
        if success:
            # Get POS transactions
            self.run_test(
                "Get POS Transactions",
                "GET",
                f"stores/{self.test_store_id}/pos-transactions",
                200,
                token=self.store_admin_token
            )
            return True
        return False

    def run_all_tests(self):
        """Run comprehensive test suite"""
        self.log("🚀 Starting Dynamic Web App Configurator API Tests")
        self.log(f"Testing against: {self.base_url}")
        
        # Authentication Tests
        if not self.test_super_admin_login():
            self.log("❌ Super admin login failed - stopping tests")
            return False

        # Store Management Tests
        if not self.test_create_store():
            self.log("❌ Store creation failed - stopping tests")
            return False

        # User Management Tests
        if not self.test_create_store_admin():
            self.log("❌ Store admin creation failed - continuing with limited tests")

        if not self.test_create_end_user():
            self.log("❌ End user creation failed - continuing with limited tests")

        # Core Business Logic Tests
        self.test_product_management()
        self.test_inventory_management()
        self.test_subscription_plans()
        self.test_vendor_and_po_management()
        self.test_pos_transactions()
        self.test_page_editor_apis()

        # Customer Flow Tests
        if self.end_user_token:
            self.test_address_management()
            self.test_order_flow()
            self.test_subscription_flow()
            self.test_mock_payment_flow()

        # Print Results
        self.log("\n" + "="*60)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            self.log("\n❌ Failed Tests:")
            for test in self.failed_tests:
                self.log(f"  • {test['test']}: Expected {test['expected']}, got {test['actual']} - {test['error']}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        self.log(f"✅ Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80  # Consider 80%+ as passing

def main():
    tester = DynamicWebAppTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())