#!/usr/bin/env python3
"""Fix API wrapper test expectations to match transformed types."""

import re

# Read the test file
with open('src/services/api/apiWrappers.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern: mockResponse = { ... }
# We need to change mockResponse to mockApiResponse and add transformed expectations

# Fix listFoodEntries
content = re.sub(
    r'(it\("listFoodEntries calls apiFetch with query params".*?const )(mockResponse)( = \[[\s\S]*?\];)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual([{\n' +
        '        id: "entry-1",\n' +
        '        productId: "p1",\n' +
        '        portionId: "por1",\n' +
        '        day: "2025-01-01",\n' +
        '        mealType: "lunch",\n' +
        '        amount: 100,\n' +
        '        unit: "g",\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      }]);'
    ),
    content,
    count=1
)

# Fix createFoodEntry
content = re.sub(
    r'(it\("createFoodEntry calls apiFetch with POST".*?const )(mockResponse)( = \{[\s\S]*?\};)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual({\n' +
        '        id: "entry-1",\n' +
        '        productId: "p1",\n' +
        '        portionId: "por1",\n' +
        '        day: "2025-01-01",\n' +
        '        mealType: "lunch",\n' +
        '        amount: 100,\n' +
        '        unit: "g",\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      });'
    ),
    content,
    count=1
)

# Fix getFoodEntry
content = re.sub(
    r'(it\("getFoodEntry calls apiFetch with entry ID".*?const )(mockResponse)( = \{[\s\S]*?\};)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual({\n' +
        '        id: "entry-1",\n' +
        '        productId: "p1",\n' +
        '        portionId: "por1",\n' +
        '        day: "2025-01-01",\n' +
        '        mealType: "lunch",\n' +
        '        amount: 100,\n' +
        '        unit: "g",\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      });'
    ),
    content,
    count=1
)

# Fix updateFoodEntry
content = re.sub(
    r'(it\("updateFoodEntry calls apiFetch with PATCH".*?const )(mockResponse)( = \{[\s\S]*?\};)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual({\n' +
        '        id: "entry-1",\n' +
        '        productId: "p1",\n' +
        '        portionId: "por1",\n' +
        '        day: "2025-01-01",\n' +
        '        mealType: "dinner",\n' +
        '        amount: 150,\n' +
        '        unit: "g",\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      });'
    ),
    content,
    count=1
)

# Fix listPortions
content = re.sub(
    r'(it\("listPortions calls apiFetch with product ID".*?const )(mockResponse)( = \[[\s\S]*?\];)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual([{\n' +
        '        id: "por1",\n' +
        '        productId: "p1",\n' +
        '        label: "100g",\n' +
        '        baseAmount: 100,\n' +
        '        baseUnit: "g",\n' +
        '        calories: 200,\n' +
        '        protein: 20,\n' +
        '        carbs: 10,\n' +
        '        fat: 5,\n' +
        '        isDefault: true,\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      }]);'
    ),
    content,
    count=1
)

# Fix createPortion
content = re.sub(
    r'(it\("createPortion calls apiFetch with POST".*?const )(mockResponse)( = \{[\s\S]*?\};)(.*?vi\.mocked\(apiFetch\)\.mockResolvedValue\()(mockResponse)(\);)(.*?expect\(result\)\.toEqual\()(mockResponse)(\);)',
    lambda m: (
        m.group(1) + 'mockApiResponse' + m.group(3) +
        m.group(4) + 'mockApiResponse' + m.group(6) +
        m.group(7) + 'expect(result).toEqual({\n' +
        '        id: "por1",\n' +
        '        productId: "p1",\n' +
        '        label: "100g",\n' +
        '        baseAmount: 100,\n' +
        '        baseUnit: "g",\n' +
        '        calories: 200,\n' +
        '        protein: 20,\n' +
        '        carbs: 10,\n' +
        '        fat: 5,\n' +
        '        isDefault: true,\n' +
        '        createdAt: "",\n' +
        '        updatedAt: "",\n' +
        '      });'
    ),
    content,
    count=1
)

# Write back
with open('src/services/api/apiWrappers.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("OK Fixed API wrapper test expectations")
