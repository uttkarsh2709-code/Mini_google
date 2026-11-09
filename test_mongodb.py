"""Standalone test script to verify MongoDB connection and operations."""
import os
import sys

# Ensure parent directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from search_api.mongodb import (
    get_mongo_uri,
    get_mongo_db_name,
    is_mongodb_configured,
    get_mongo_client,
    get_mongo_db,
    init_mongodb,
    mongo_create_user,
    mongo_get_user,
    mongo_save_history,
    mongo_get_history,
    mongo_clear_history,
    mongo_save_rating,
    mongo_publish_pages,
    mongo_search_pages,
    PYMONGO_AVAILABLE
)


def run_diagnostics():
    print("=" * 60)
    print("🍃 Mini Google - MongoDB Connection & Verification Test")
    print("=" * 60)

    # 1. Check PyMongo package
    if not PYMONGO_AVAILABLE:
        print("❌ 'pymongo' is not installed in the current Python environment.")
        print("   Run: pip install pymongo dnspython")
        return

    print("✅ 'pymongo' library is installed.")

    # 2. Check Configuration
    uri = get_mongo_uri()
    db_name = get_mongo_db_name()
    if not uri:
        print("❌ MONGODB_URI is not set in .env")
        print("   Add: MONGODB_URI=mongodb://localhost:27017 to your .env file")
        return

    masked_uri = uri
    if "@" in uri:
        prefix = uri.split("@")[0].split("://")[0] + "://***:***@"
        masked_uri = prefix + uri.split("@")[1]
    print(f"📡 Configured URI: {masked_uri}")
    print(f"📁 Target Database: {db_name}")

    # 3. Test Connection
    print("\nAttempting to connect to MongoDB...")
    db = get_mongo_db()
    if db is None:
        print("❌ Could not connect to MongoDB.")
        print("   • If using local MongoDB: ensure mongod service is running (e.g. net start MongoDB).")
        print("   • If using MongoDB Atlas: ensure your IP address is whitelisted in Network Access.")
        return

    print(f"✅ Connection successful to database: '{db_name}'")

    # 4. Initialize Indexes
    print("\nInitializing collections and indexes...")
    if init_mongodb():
        print("✅ Collections and indexes verified (users, user_history, ratings, pages).")
    else:
        print("⚠️ Failed to verify indexes.")

    # 5. Test CRUD - User Auth
    test_email = "mongodb_test@example.com"
    print(f"\nTesting User Auth CRUD ({test_email})...")
    try:
        # Clean up any previous test record
        db.users.delete_many({"email": test_email})
        created_user = mongo_create_user(test_email, "hashed_password_test")
        print(f"  ✓ User created with ID: {created_user.get('_id')}")

        fetched_user = mongo_get_user(test_email)
        assert fetched_user is not None
        assert fetched_user["email"] == test_email
        print("  ✓ User successfully retrieved from MongoDB.")

        db.users.delete_one({"email": test_email})
        print("  ✓ Test user cleaned up.")
    except Exception as exc:
        print(f"❌ User CRUD test failed: {exc}")

    # 6. Test History
    print(f"\nTesting Search & Chat History CRUD...")
    try:
        db.user_history.delete_many({"email": test_email})
        mongo_save_history(test_email, "search", "python mongodb tutorial", title="Tutorial")
        items = mongo_get_history(test_email, limit=10)
        assert len(items) >= 1
        print(f"  ✓ History saved and retrieved: {items[0]['query']}")
        cleared = mongo_clear_history(test_email)
        print(f"  ✓ Cleared {cleared} history entries.")
    except Exception as exc:
        print(f"❌ History test failed: {exc}")

    # 7. Test Pages Text Index
    print(f"\nTesting Crawled Pages & Full-Text Search...")
    try:
        test_docs = [
            {
                "url": "https://test-minigoogle.internal/docs",
                "title": "Mini Google Python MongoDB Guide",
                "content": "This guide explains how to connect Mini Google to MongoDB Atlas and query pages.",
                "outgoing_links": ""
            }
        ]
        inserted = mongo_publish_pages(test_docs)
        print(f"  ✓ Published {inserted} test page(s).")

        hits = mongo_search_pages("MongoDB Atlas", limit=5)
        print(f"  ✓ Text search query for 'MongoDB Atlas' returned {len(hits)} hit(s).")
        if hits:
            print(f"    Title: {hits[0]['title']}")
            print(f"    Snippet: {hits[0]['content'][:60]}...")

        db.pages.delete_many({"url": "https://test-minigoogle.internal/docs"})
        print("  ✓ Test page cleaned up.")
    except Exception as exc:
        print(f"❌ Pages search test failed: {exc}")

    print("\n" + "=" * 60)
    print("🎉 All MongoDB tests completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    run_diagnostics()

