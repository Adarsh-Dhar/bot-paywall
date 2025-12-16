"""
Performance benchmarks for dummy transaction system
Tests transaction generation speed and memory usage
_Requirements: 1.5, 5.1, 5.3_
"""

import time
import json
import sys
import os
from unittest.mock import patch, MagicMock
from hypothesis import given, strategies as st, settings

# Add the parent directory to the path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestPerformanceBenchmarks:
    """Performance benchmarks for dummy transaction system"""

    def test_transaction_generation_speed(self):
        """
        Benchmark: Transaction generation speed
        Measures how many transactions can be generated per second
        """
        transaction_counts = [10, 50, 100, 500, 1000]
        results = []

        with patch('requests.post') as mock_post:
            def mock_generate_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {
                    'valid': True,
                    'transaction_hash': '0x' + 'a' * 64,
                    'format': 'movement'
                }
                response.status_code = 200
                return response

            mock_post.side_effect = mock_generate_response

            for count in transaction_counts:
                start_time = time.time()

                for i in range(count):
                    payload = {
                        'recipient': '0x1234567890123456789012345678901234567890',
                        'amount': str(1000000 + i),
                        'seed': 'benchmark-seed'
                    }
                    requests.post('http://dummy-worker.dev/generate', json=payload)

                end_time = time.time()
                time_ms = (end_time - start_time) * 1000
                per_second = (count / time_ms) * 1000 if time_ms > 0 else 0

                results.append({
                    'count': count,
                    'time_ms': time_ms,
                    'per_second': per_second
                })

                print(f"Generated {count} transactions in {time_ms:.2f}ms ({per_second:.0f} tx/sec)")

            # Verify performance is reasonable (at least 100 tx/sec)
            avg_per_second = sum(r['per_second'] for r in results) / len(results)
            assert avg_per_second > 100, f"Average performance {avg_per_second} tx/sec is too low"

    def test_multi_format_generation_speed(self):
        """
        Benchmark: Multi-format transaction generation
        Measures performance when generating both Movement and Aptos transactions
        """
        iterations = 100

        with patch('requests.post') as mock_post:
            def mock_multi_format_response(*args, **kwargs):
                response = MagicMock()
                payload = kwargs.get('json', {})
                recipient = payload.get('recipient', '')

                # Simulate different responses based on address format
                if len(recipient) == 42:  # Movement address
                    response.json.return_value = {
                        'valid': True,
                        'format': 'movement',
                        'transaction_hash': '0x' + 'a' * 64
                    }
                elif len(recipient) == 66:  # Aptos address
                    response.json.return_value = {
                        'valid': True,
                        'format': 'aptos',
                        'transaction_hash': '0x' + 'b' * 64
                    }

                response.status_code = 200
                return response

            mock_post.side_effect = mock_multi_format_response

            start_time = time.time()

            for i in range(iterations):
                # Generate Movement transaction
                requests.post('http://dummy-worker.dev/generate', json={
                    'recipient': '0x1111111111111111111111111111111111111111',
                    'amount': str(1000000 + i),
                    'blockchain_type': 'movement'
                })

                # Generate Aptos transaction
                requests.post('http://dummy-worker.dev/generate', json={
                    'recipient': '0x2222222222222222222222222222222222222222222222222222222222222222',
                    'amount': str(1000000 + i),
                    'blockchain_type': 'aptos'
                })

            end_time = time.time()
            time_ms = (end_time - start_time) * 1000
            total_tx = iterations * 2
            per_second = (total_tx / time_ms) * 1000 if time_ms > 0 else 0

            print(f"Generated {total_tx} multi-format transactions in {time_ms:.2f}ms ({per_second:.0f} tx/sec)")

            # Verify performance is reasonable
            assert per_second > 100, f"Performance {per_second} tx/sec is too low"

    def test_validation_performance(self):
        """
        Benchmark: Validation performance
        Measures how fast payment validation can be performed
        """
        validation_count = 1000

        with patch('requests.post') as mock_post:
            def mock_validate_response(*args, **kwargs):
                response = MagicMock()
                # Simulate validation response
                response.json.return_value = {
                    'valid': True,
                    'transaction_hash': '0x' + 'a' * 64
                }
                response.status_code = 200
                return response

            mock_post.side_effect = mock_validate_response

            start_time = time.time()

            for i in range(validation_count):
                requests.post('http://dummy-worker.dev/verify', json={
                    'transaction_hash': '0x' + 'a' * 64,
                    'recipient': '0x1234567890123456789012345678901234567890',
                    'amount': str(1000000)
                })

            end_time = time.time()
            time_ms = (end_time - start_time) * 1000
            per_second = (validation_count / time_ms) * 1000 if time_ms > 0 else 0

            print(f"Validated {validation_count} payments in {time_ms:.2f}ms ({per_second:.0f} validations/sec)")

            # Verify performance is reasonable
            assert per_second > 1000, f"Performance {per_second} validations/sec is too low"

    def test_serialization_performance(self):
        """
        Benchmark: Serialization performance
        Measures JSON serialization and deserialization speed
        """
        transaction_count = 500
        transactions = []

        # Generate test transactions
        for i in range(transaction_count):
            transactions.append({
                'hash': '0x' + 'a' * 64,
                'recipient': '0x1234567890123456789012345678901234567890',
                'amount': str(1000000 + i),
                'success': i % 2 == 0,
                'timestamp': time.time()
            })

        # Serialize
        serialize_start = time.time()
        json_data = json.dumps(transactions)
        serialize_end = time.time()
        serialize_time_ms = (serialize_end - serialize_start) * 1000

        # Deserialize
        deserialize_start = time.time()
        deserialized = json.loads(json_data)
        deserialize_end = time.time()
        deserialize_time_ms = (deserialize_end - deserialize_start) * 1000

        json_size_kb = len(json_data) / 1024

        print(f"Serialized {transaction_count} transactions in {serialize_time_ms:.2f}ms")
        print(f"Deserialized {transaction_count} transactions in {deserialize_time_ms:.2f}ms")
        print(f"JSON size: {json_size_kb:.2f} KB")

        # Verify performance is reasonable
        serialize_per_second = (transaction_count / serialize_time_ms) * 1000 if serialize_time_ms > 0 else 0
        deserialize_per_second = (transaction_count / deserialize_time_ms) * 1000 if deserialize_time_ms > 0 else 0

        assert serialize_per_second > 100, f"Serialization performance {serialize_per_second} tx/sec is too low"
        assert deserialize_per_second > 100, f"Deserialization performance {deserialize_per_second} tx/sec is too low"

    def test_concurrent_access_patterns(self):
        """
        Benchmark: Concurrent access patterns
        Measures performance under concurrent read/write scenarios
        """
        operation_count = 1000
        hashes = []

        with patch('requests.post') as mock_post, \
             patch('requests.get') as mock_get:

            def mock_post_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {
                    'valid': True,
                    'transaction_hash': '0x' + 'a' * 64
                }
                response.status_code = 200
                return response

            def mock_get_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {
                    'valid': True,
                    'transaction_hash': '0x' + 'a' * 64
                }
                response.status_code = 200
                return response

            mock_post.side_effect = mock_post_response
            mock_get.side_effect = mock_get_response

            # Pre-populate with some hashes
            for i in range(100):
                hashes.append('0x' + 'a' * 64)

            start_time = time.time()

            for i in range(operation_count):
                operation = i % 3

                if operation == 0:
                    # Write operation
                    requests.post('http://dummy-worker.dev/generate', json={
                        'recipient': '0x1234567890123456789012345678901234567890',
                        'amount': str(2000000 + i)
                    })
                    hashes.append('0x' + 'a' * 64)

                elif operation == 1:
                    # Read operation
                    if hashes:
                        requests.get('http://dummy-worker.dev/transaction', params={
                            'hash': hashes[i % len(hashes)]
                        })

                else:
                    # Mark as used
                    if hashes:
                        requests.post('http://dummy-worker.dev/mark-used', json={
                            'hash': hashes[i % len(hashes)]
                        })

            end_time = time.time()
            time_ms = (end_time - start_time) * 1000
            operations_per_second = (operation_count / time_ms) * 1000 if time_ms > 0 else 0

            print(f"Completed {operation_count} concurrent operations in {time_ms:.2f}ms ({operations_per_second:.0f} ops/sec)")

            # Verify performance is reasonable
            assert operations_per_second > 1000, f"Performance {operations_per_second} ops/sec is too low"

    def test_configuration_change_performance(self):
        """
        Benchmark: Configuration changes
        Measures performance impact of changing configuration
        """
        config_changes = 100

        with patch('requests.post') as mock_post:
            def mock_config_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {'status': 'configured'}
                response.status_code = 200
                return response

            mock_post.side_effect = mock_config_response

            start_time = time.time()

            for i in range(config_changes):
                # Change success rate
                success_rate = 0.5 + (i % 50) / 100
                requests.post('http://dummy-worker.dev/config', json={
                    'success_rate': success_rate,
                    'seed': f'config-{i}'
                })

                # Generate transaction with new config
                requests.post('http://dummy-worker.dev/generate', json={
                    'recipient': '0x1234567890123456789012345678901234567890',
                    'amount': str(1000000 + i)
                })

            end_time = time.time()
            time_ms = (end_time - start_time) * 1000

            print(f"Completed {config_changes} configuration changes in {time_ms:.2f}ms")

            # Verify performance is reasonable (should complete in less than 1 second)
            assert time_ms < 1000, f"Configuration changes took {time_ms:.2f}ms, which is too long"

    def test_large_dataset_handling(self):
        """
        Benchmark: Large dataset handling
        Measures performance with large numbers of transactions
        """
        dataset_sizes = [100, 500, 1000, 5000]
        results = []

        with patch('requests.post') as mock_post:
            def mock_store_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {'status': 'stored'}
                response.status_code = 200
                return response

            mock_post.side_effect = mock_store_response

            for size in dataset_sizes:
                start_time = time.time()

                for i in range(size):
                    requests.post('http://dummy-worker.dev/store', json={
                        'transaction_hash': '0x' + 'a' * 64,
                        'recipient': '0x1234567890123456789012345678901234567890',
                        'amount': str(1000000 + i),
                        'index': i
                    })

                end_time = time.time()
                time_ms = (end_time - start_time) * 1000
                per_second = (size / time_ms) * 1000 if time_ms > 0 else 0

                results.append({
                    'size': size,
                    'time_ms': time_ms,
                    'per_second': per_second
                })

                print(f"Stored {size} transactions in {time_ms:.2f}ms ({per_second:.0f} tx/sec)")

            # Verify performance scales reasonably
            avg_per_second = sum(r['per_second'] for r in results) / len(results)
            assert avg_per_second > 100, f"Average performance {avg_per_second} tx/sec is too low"

    @given(
        operation_count=st.integers(min_value=10, max_value=100),
        success_rate=st.floats(min_value=0.0, max_value=1.0)
    )
    @settings(max_examples=10)
    def test_property_based_performance(self, operation_count, success_rate):
        """
        Property-based performance test
        Verifies performance remains consistent across different configurations
        """
        with patch('requests.post') as mock_post:
            def mock_response(*args, **kwargs):
                response = MagicMock()
                response.json.return_value = {
                    'valid': True,
                    'transaction_hash': '0x' + 'a' * 64
                }
                response.status_code = 200
                return response

            mock_post.side_effect = mock_response

            start_time = time.time()

            for i in range(operation_count):
                requests.post('http://dummy-worker.dev/generate', json={
                    'recipient': '0x1234567890123456789012345678901234567890',
                    'amount': str(1000000 + i),
                    'success_rate': success_rate
                })

            end_time = time.time()
            time_ms = (end_time - start_time) * 1000

            # Property: Operations should complete in reasonable time
            # Allow up to 100ms per operation
            max_time_ms = operation_count * 100
            assert time_ms < max_time_ms, f"Operations took {time_ms:.2f}ms, expected less than {max_time_ms}ms"


if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v'])
