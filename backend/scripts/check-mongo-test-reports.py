"""Fail CI if the key MongoDB transaction tests were silently skipped."""

from pathlib import Path
import sys
import xml.etree.ElementTree as ET

reports = Path("backend/target/surefire-reports")
required = {
    "TeamRoleMongoTest": "concurrentSelfDemotionsKeepAnAdministratorAndAuditOnlySuccess",
    "PrivateNotificationMongoTest": "abortedTransactionPublishesNothingAndCommittedEventIsConsumed",
}

for test_class, test_name in required.items():
    matches = list(reports.glob(f"TEST-*.{test_class}.xml"))
    if len(matches) != 1:
        sys.exit(f"Missing or ambiguous report for {test_class}")
    test = next((case for case in ET.parse(matches[0]).getroot().iter("testcase")
                 if case.get("name") == test_name), None)
    if test is None or any(test.find(tag) is not None for tag in ("skipped", "failure", "error")):
        sys.exit(f"Required transaction test did not pass: {test_class}.{test_name}")
    print(f"Verified {test_class}.{test_name}")
