import DateTimePicker from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";
import styles from "./Style";
interface PickerItem {
  label: string;
  value: string;
}

interface ExpiryItem {
  date: string;
  qty: number;
}

interface SelectedExpiryInfo {
  skuKey: string;
  version: string;
  index: number;
}

interface SkuData {
  [version: string]: Array<{
    label: string;
    value: string;
    code: string;
  }>;
}

interface AndroidPickerProps {
  label: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: PickerItem[];
}

const AndroidPicker: React.FC<AndroidPickerProps> = ({
  label,
  selectedValue,
  onValueChange,
  items,
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.dropdown}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={(itemValue: string) => onValueChange(itemValue)}
        mode="dialog"
        prompt={label}
      >
        {items.map((item) => (
          <Picker.Item
            key={item.value}
            label={item.label}
            value={item.value}
            color="#000000"
          />
        ))}
      </Picker>
    </View>
  </>
);

type AvailabilityType = "Carried" | "Not Carried";
type VersionType = "SKU";

interface GroupedInventory {
  date: string;
  email: string;
  merchandiser: string;
  outlet: string;
  weeksCovered: string;
  month: string;
  week: string;
  locked: boolean;
  versions: {
    [key in VersionType]: {
      Carried: Array<{
        sku: string;
        skuCode: string;
        beginningPCS: number;
        deliveryPCS: number;
        endingPCS: number;
        offtake: number;
        inventoryDays: number;
        expiryMonths: string[];
        expiryQty: number[];
      }>;
      "Not Carried": Array<{ sku: string; skuCode: string }>;
    };
  };
}

const LabeledInput = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  style?: ViewStyle;
}) => (
  <View style={style}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

export default function InventoryNextWeek() {
  const {
    data,
    previousWeekId,
    skuCodeMapping: skuCodeMappingStr,
  } = useLocalSearchParams();

  const rawData = Array.isArray(data) ? data[0] : data;
  if (!rawData || typeof rawData !== "string") {
    throw new Error("Invalid or missing data parameter");
  }
  const parsedData = JSON.parse(rawData);
  const [showPicker, setShowPicker] = useState(false);
  const [currentSkuKey, setCurrentSkuKey] = useState<string | null>(null);
  const [currentExpiryIndex, setCurrentExpiryIndex] = useState<number | null>(
    null
  );

  const skuCodeMappingRaw = Array.isArray(skuCodeMappingStr)
    ? skuCodeMappingStr[0]
    : skuCodeMappingStr;
  const parsedSkuCodeMapping =
    skuCodeMappingRaw && typeof skuCodeMappingRaw === "string"
      ? JSON.parse(skuCodeMappingRaw)
      : {};
  const [loading, setLoading] = useState(false);
  const skuCodeMapping = parsedSkuCodeMapping || {};

  const [skuValues, setSkuValues] = useState(parsedData.skuValues || {});
  const [availability, setAvailability] = useState(
    parsedData.availability || {}
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [version, setVersion] = useState(parsedData.version);
  const [weeksCovered, setWeeksCovered] = useState(parsedData.weeksCovered);
  const [month, setMonth] = useState(parsedData.month);
  const [week, setWeek] = useState(parsedData.week);
  const [outlet] = useState(parsedData.outlet);
  const [merchandiser] = useState(parsedData.merchandiser);
  const [email] = useState(parsedData.email);
  const [date] = useState(parsedData.date);
  const isNetworkError = (error: any) =>
    error instanceof TypeError && error.message === "Network request failed";

  const [skuData, setSkuData] = useState<SkuData>({
    SKU: [],
  });

  const [selectedExpiryInfo, setSelectedExpiryInfo] =
    useState<SelectedExpiryInfo | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!version) return;

    const newOfftake: Record<string, string> = {};
    const newInventoryDays: Record<string, string> = {};

    filteredSkuOptions.forEach((skuItem) => {
      const beginning = parseFloat(
        skuValues.beginning?.[version]?.[skuItem.value] || "0"
      );
      const delivery = parseFloat(
        skuValues.delivery?.[version]?.[skuItem.value] || "0"
      );
      const ending = parseFloat(
        skuValues.ending?.[version]?.[skuItem.value] || "0"
      );

      const calculatedOfftake = beginning + delivery - ending;
      newOfftake[skuItem.value] = calculatedOfftake.toFixed(2);

      if (calculatedOfftake === 0) {
        newInventoryDays[skuItem.value] = "";
      } else {
        const inventoryDaysLevel = ending / (calculatedOfftake / 7);
        newInventoryDays[skuItem.value] = inventoryDaysLevel.toFixed(2);
      }
    });

    setSkuValues((prev: any) => ({
      ...prev,
      offtake: {
        ...prev.offtake,
        [version]: newOfftake,
      },
      inventoryDays: {
        ...prev.inventoryDays,
        [version]: newInventoryDays,
      },
    }));
  }, [
    skuValues.beginning?.[version],
    skuValues.delivery?.[version],
    skuValues.ending?.[version],
    version,
  ]);

  useEffect(() => {
    if (expandedSection === "Expiry") {
      Object.keys(skuData[version] || {}).forEach((_, i) => {
        const skuKey = skuData[version][i].value;
        const hasExpiry = skuValues.expiry?.[version]?.[skuKey]?.length > 0;

        if (!hasExpiry) {
          addExpiryEntry(skuKey, version); // This will add the first entry in actual state
        }
      });
    }
  }, [expandedSection, skuData, version, skuValues.expiry]);

  useEffect(() => {
    const today = moment();

    // 1️⃣ Get current week's Monday and Friday
    const weekStart = today.clone().startOf("isoWeek"); // Monday
    const weekEnd = today.clone().isoWeekday(5); // Friday

    // 2️⃣ Format label like "Jun16-Jun20"
    const label = `${weekStart.format("MMMDD")}-${weekEnd.format("MMMDD")}`;
    setWeeksCovered(label);

    // 3️⃣ Month (based on Friday)
    const monthName = weekEnd.format("MMMM");
    setMonth(monthName);

    // 4️⃣ Week number: count Fridays since the first Friday of the year
    const startOfYear = moment().startOf("year");
    const firstFriday = startOfYear.clone().day(5).isBefore(startOfYear)
      ? startOfYear.clone().add(1, "week").day(5)
      : startOfYear.clone().day(5);

    const weekNum = weekEnd.diff(firstFriday, "weeks") + 1;
    setWeek(`Week ${weekNum}`);

    const newSkuValues = { ...skuValues };
    Object.keys(skuValues?.ending?.[version] || {}).forEach((skuKey) => {
      newSkuValues.beginning = {
        ...(newSkuValues.beginning || {}),
        [version]: {
          ...(newSkuValues.beginning?.[version] || {}),
          [skuKey]: skuValues.ending[version][skuKey],
        },
      };
    });
    setSkuValues(newSkuValues);
  }, []);

  const handleInputChange = (
    field: string,
    skuKey: string,
    value: string | number
  ) => {
    setSkuValues((prev: any) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [version]: {
          ...(prev[field]?.[version] || {}),
          [skuKey]: value,
        },
      },
    }));
  };

  const showDatePicker = (skuKey: string, version: string, index: number) => {
    setSelectedExpiryInfo({ skuKey, version, index });
    setShowPicker(true);
  };

  const onDateChange = (event: { type: string }, selectedDate?: Date) => {
    if (event.type === "set" && selectedExpiryInfo && selectedDate) {
      const { skuKey, version, index } = selectedExpiryInfo;

      // Format: 18JUN25
      const day = selectedDate.getDate().toString().padStart(2, "0");
      const month = selectedDate
        .toLocaleString("en-PH", { month: "short" })
        .toUpperCase();
      const year = selectedDate.getFullYear().toString().slice(-2);
      const formattedDate = `${day}${month}${year}`;

      setSkuValues((prev: any) => {
        const updated = { ...prev };
        const expiryList = updated.expiry?.[version]?.[skuKey] || [];

        const updatedExpiryList = [...expiryList];
        if (updatedExpiryList[index]) {
          updatedExpiryList[index] = {
            ...updatedExpiryList[index],
            date: formattedDate,
          };
        }

        return {
          ...updated,
          expiry: {
            ...updated.expiry,
            [version]: {
              ...updated.expiry?.[version],
              [skuKey]: updatedExpiryList,
            },
          },
        };
      });

      setShowPicker(false);
      setSelectedExpiryInfo(null);
    } else {
      setShowPicker(false);
      setSelectedExpiryInfo(null);
    }
  };

  // Helper function to format the date as "16NOV24"
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
  };

  // const handleQuantityChange = (skuKey: string, qty: string) => {
  //   setSkuValues((prev: any) => ({
  //     ...prev,
  //     quantity: {
  //       ...prev.quantity,
  //       [skuKey]: qty,
  //     },
  //   }));
  // };

  const handleExpiryQtyChange = (
    skuKey: string,
    version: string,
    expiryIndex: number,
    qty: string
  ) => {
    setSkuValues((prev: any) => {
      const currentExpiryList = prev.expiry?.[version]?.[skuKey] || [];
      const updatedExpiryList = [...currentExpiryList];
      updatedExpiryList[expiryIndex] = {
        ...updatedExpiryList[expiryIndex],
        qty: qty === "" ? "" : Number(qty),
      };
      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...(prev.expiry?.[version] || {}),
            [skuKey]: updatedExpiryList,
          },
        },
      };
    });
  };

  const addExpiryEntry = (skuKey: string, version: string) => {
    setSkuValues((prev: any) => {
      const prevEntries = prev.expiry?.[version]?.[skuKey] || [];
      const updatedEntries = [...prevEntries, { date: "", qty: "" }];

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...prev.expiry?.[version],
            [skuKey]: updatedEntries,
          },
        },
      };
    });
  };

  const deleteExpiryEntry = (
    skuKey: string,
    version: string,
    index: number
  ) => {
    setSkuValues((prev: any) => {
      const prevEntries = prev.expiry?.[version]?.[skuKey] || [];
      const updatedEntries = prevEntries.filter(
        (_: any, i: number) => i !== index
      );

      return {
        ...prev,
        expiry: {
          ...prev.expiry,
          [version]: {
            ...prev.expiry?.[version],
            [skuKey]: updatedEntries,
          },
        },
      };
    });
  };

  const filteredSkuOptions = Object.keys(
    parsedData.skuValues?.beginning?.[parsedData.version] || {}
  ).map((skuKey) => ({
    label: skuKey,
    value: skuKey,
    code: skuCodeMapping[parsedData.version]?.[skuKey] || "N/A",
  }));

  const getCompletedSkuCount = () => {
    let completedCount = 0;

    ["SKU"].forEach((v) => {
      const versionSkus = Object.keys(skuValues?.beginning?.[v] || {}).map(
        (skuKey) => ({
          label: skuKey,
          value: skuKey,
        })
      );

      versionSkus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const avail = availability?.[v]?.[skuKey];

        if (avail === "Not Carried") {
          completedCount++;
        } else {
          const b = skuValues.beginning?.[v]?.[skuKey] || "";
          const d = skuValues.delivery?.[v]?.[skuKey] || "";
          const e = skuValues.ending?.[v]?.[skuKey] || "";

          if (b !== "" && d !== "" && e !== "") {
            completedCount++;
          }
        }
      });
    });

    return completedCount;
  };

  const getTotalSkuCount = () => {
    let totalCount = 0;

    ["SKU"].forEach((v) => {
      totalCount += Object.keys(skuValues?.beginning?.[v] || {}).length;
    });

    return totalCount;
  };

  const handleConditionalSubmit = () => {
    const incompleteVersions: string[] = [];

    ["SKU"].forEach((version) => {
      const skuList = skuData[version];
      const isVersionComplete = skuList.every((sku) => {
        const key = sku.value;
        const isNotCarried = availability[version]?.[key] === "Not Carried";

        const hasAllValues =
          skuValues.beginning?.[version]?.[key] &&
          skuValues.delivery?.[version]?.[key] &&
          skuValues.ending?.[version]?.[key];

        return isNotCarried || hasAllValues;
      });

      if (!isVersionComplete) {
        incompleteVersions.push(version);
      }
    });

    if (incompleteVersions.length > 0) {
      Alert.alert(
        "Incomplete SKUs",
        `Please complete all SKUs in: ${incompleteVersions.join(", ")}`,
        [{ text: "OK" }]
      );
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!merchandiser || !outlet || !weeksCovered || !month || !week) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);

    const versions: VersionType[] = ["SKU"];
    const groupedInventory: GroupedInventory = {
      email,
      date,
      merchandiser,
      outlet,
      weeksCovered,
      month,
      week,
      locked: false,
      versions: {
        SKU: { Carried: [], "Not Carried": [] },
      },
    };

    versions.forEach((v) => {
      const skus = skuData[v]?.filter((item) => item.value !== "") || [];

      skus.forEach((skuItem) => {
        const skuKey = skuItem.value;
        const status = (availability[v]?.[skuKey] ||
          "Carried") as AvailabilityType;
        const commonFields = {
          sku: skuItem.label,
          skuCode: skuItem.code || skuKey,
        };

        if (status === "Carried") {
          const expiryList = skuValues.expiry?.[v]?.[skuKey] || [];
          groupedInventory.versions[v][status].push({
            ...commonFields,
            beginningPCS: Number(skuValues.beginning?.[v]?.[skuKey] || 0),
            deliveryPCS: Number(skuValues.delivery?.[v]?.[skuKey] || 0),
            endingPCS: Number(skuValues.ending?.[v]?.[skuKey] || 0),
            offtake: Number(skuValues.offtake?.[v]?.[skuKey] || 0),
            inventoryDays: Number(skuValues.inventoryDays?.[v]?.[skuKey] || 0),

            expiryMonths: expiryList
              .map((e: ExpiryItem) => e.date)
              .filter(Boolean),
            expiryQty: expiryList.map((e: ExpiryItem) => Number(e.qty) || 0),
          });
        } else {
          groupedInventory.versions[v][status].push(commonFields);
        }
      });
    });

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        //await saveOffline();
        return;
      }

      const saveRes = await fetch(
        "https://react-brewflow-backend.onrender.com/inventory/grouped",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupedInventory),
        }
      );

      if (!saveRes.ok) throw new Error("Failed to save inventory");

      if (previousWeekId) {
        await fetch("https://react-brewflow-backend.onrender.com/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryId: Array.isArray(previousWeekId)
              ? previousWeekId[0]
              : previousWeekId,
            locked: true,
          }),
        });
      }

      router.push("/HomeScreen");
    } catch (err) {
      if (isNetworkError(err)) {
        // await saveOffline();
      } else {
        console.error("Save error:", err);
        Alert.alert("Error", "Failed to save inventory");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const newSkuData: SkuData = { SKU: [] };

    ["SKU"].forEach((v) => {
      newSkuData[v] = Object.keys(skuValues?.beginning?.[v] || {}).map(
        (skuKey) => ({
          label: skuKey,
          value: skuKey,
          code: skuCodeMapping[version]?.[skuKey] || "N/A",
        })
      );
    });

    setSkuData(newSkuData);
  }, [skuValues.beginning]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{ flex: 1 }}>
        <View style={styles.appBarInventoryprocess}>
          <Text style={styles.appBarTitleInventoryprocess}>
            UPDATE INVENTORY
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.containerinventory,
            { paddingBottom: 50, paddingTop: 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LabeledInput
            label="Date"
            value={date}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Merchandiser Name"
            value={merchandiser}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <LabeledInput
            label="Branch / Outlet"
            value={outlet}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Weeks Covered"
            value={weeksCovered}
            onChangeText={() => {}}
            editable={false}
          />
          <LabeledInput
            label="Month"
            value={month}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />
          <LabeledInput
            label="Week"
            value={week}
            onChangeText={() => {}}
            editable={false}
            style={{ height: 0, opacity: 0 }}
          />

          <Text style={styles.label}>Select Version</Text>
          <View style={styles.buttonRow}>
            {["SKU"].map((v) => {
              const versionSkus = Object.keys(skuValues?.beginning?.[v] || {});
              let completedSkuCount = 0;
              const totalSkuCount = versionSkus.length;

              versionSkus.forEach((skuKey) => {
                const avail = availability?.[v]?.[skuKey];

                if (avail === "Not Carried") {
                  completedSkuCount++;
                } else {
                  const b = skuValues.beginning?.[v]?.[skuKey] || "";
                  const d = skuValues.delivery?.[v]?.[skuKey] || "";
                  const e = skuValues.ending?.[v]?.[skuKey] || "";

                  if (b !== "" && d !== "" && e !== "") {
                    completedSkuCount++;
                  }
                }
              });

              return (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.versionBtn,
                    version === v && styles.selectedButton,
                  ]}
                  onPress={() => setVersion(v)}
                >
                  <Text style={styles.btnText}>
                    {completedSkuCount}/{totalSkuCount} {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {version !== "" && (
            <>
              {["Beginning", "Delivery", "Ending"].map((section) => {
                const sectionKey = section.toLowerCase();
                const filledCount = filteredSkuOptions.filter((skuItem) => {
                  const skuKey = skuItem.value;
                  const val = skuValues[sectionKey]?.[version]?.[skuKey];
                  const availStatus = availability[version]?.[skuKey];

                  return (
                    (val !== undefined && val !== "") ||
                    availStatus === "Not Carried"
                  );
                }).length;

                const totalSkuCount = filteredSkuOptions.length;

                return (
                  <View key={section} style={{ marginVertical: 10 }}>
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() =>
                        setExpandedSection((prev) =>
                          prev === section ? null : section
                        )
                      }
                    >
                      <Text style={styles.expandButtonText}>
                        {expandedSection === section
                          ? `Hide ${section} ${filledCount}/${totalSkuCount}`
                          : `Expand ${section} ${filledCount}/${totalSkuCount}`}
                      </Text>
                    </TouchableOpacity>
                    {expandedSection === section && (
                      <View style={{ marginTop: 10 }}>
                        {filteredSkuOptions.map((skuItem) => {
                          const skuKey = skuItem.value;
                          const isBeginning = sectionKey === "beginning";
                          const availabilityValue =
                            availability?.[version]?.[skuKey] ??
                            (isBeginning ? "Carried" : "");
                          const isBeginningEditable =
                            isBeginning && availabilityValue === "Carried";
                          const isOtherSectionEditable =
                            !isBeginning &&
                            availability[version]?.[skuKey] === "Carried";
                          const isEditable = isBeginning
                            ? isBeginningEditable
                            : isOtherSectionEditable;

                          return (
                            <TouchableOpacity
                              key={skuKey}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 8,
                              }}
                              activeOpacity={1}
                              onPress={() => {}}
                            >
                              <Text
                                style={[styles.skuText, { flex: 1 }]}
                                numberOfLines={1}
                              >
                                {skuItem.label}
                              </Text>

                              {isBeginning && (
                                <View
                                  style={{
                                    flex: 0.5,
                                    marginHorizontal: 2,
                                    borderWidth: 1,
                                    borderColor: "#ccc",
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    minWidth: 20,
                                  }}
                                >
                                  <Picker
                                    selectedValue={availabilityValue}
                                    style={{
                                      height: 50,
                                      width: "100%",
                                      backgroundColor: "white",
                                    }}
                                    itemStyle={{
                                      fontSize: 11, // Adjust this value as needed
                                    }}
                                    onValueChange={(value) => {
                                      // Update availability based on selected value
                                      setAvailability((prev: any) => ({
                                        ...prev,
                                        [version]: {
                                          ...(prev[version] || {}),
                                          [skuKey]: value,
                                        },
                                      }));

                                      // When 'Not Carried' is selected, we don't reset the values, just hide them.
                                      if (value === "Carried") {
                                        const prevEnding =
                                          skuValues.ending?.[version]?.[
                                            skuKey
                                          ] || "";
                                        if (prevEnding !== "") {
                                          setSkuValues((prev: any) => ({
                                            ...prev,
                                            beginning: {
                                              ...(prev.beginning || {}),
                                              [version]: {
                                                ...(prev.beginning?.[version] ||
                                                  {}),
                                                [skuKey]: prevEnding, // Restore value from ending to beginning
                                              },
                                            },
                                          }));
                                        }
                                      }
                                      // If "Not Carried" is selected, we can just leave the values intact but hide inputs
                                    }}
                                    mode="dropdown"
                                  >
                                    <Picker.Item
                                      label="Carried"
                                      value="Carried"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                    <Picker.Item
                                      label="Not Carried"
                                      value="Not Carried"
                                      style={{ fontSize: 11, color: "black" }}
                                    />
                                  </Picker>
                                </View>
                              )}

                              <TextInput
                                style={[
                                  styles.inputBox,
                                  {
                                    width: 52,
                                    height: 40,
                                    marginLeft: isBeginning ? 0 : 6,
                                    textAlign: "center",
                                    backgroundColor:
                                      availabilityValue === "Carried"
                                        ? "#FFFFFF"
                                        : "#f0f0f0", // light blue if carried, gray otherwise
                                    borderColor:
                                      availabilityValue === "Carried"
                                        ? "#2c1c5c"
                                        : "#ccc", // teal if carried
                                    borderWidth: 1,
                                  },
                                ]}
                                keyboardType="numeric"
                                value={
                                  availabilityValue === "Carried"
                                    ? skuValues[sectionKey]?.[version]?.[
                                        skuKey
                                      ] || ""
                                    : ""
                                }
                                onChangeText={(text) => {
                                  handleInputChange(sectionKey, skuKey, text);
                                }}
                                editable={isEditable}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Expiry" ? null : "Expiry"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Expiry"
                      ? `Hide Expiry`
                      : `Expand Expiry`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Expiry" && (
                  <View style={{ marginTop: 10 }}>
                    {skuData[version]?.map((skuItem) => {
                      const skuKey = skuItem.value;
                      const availabilityValue =
                        availability[version]?.[skuKey] || "Carried";
                      const isEditable = availabilityValue === "Carried";

                      const expiryEntriesRaw =
                        skuValues.expiry?.[version]?.[skuKey] || [];
                      // Ensure at least one expiry entry to show SKU immediately
                      const expiryEntries =
                        expiryEntriesRaw.length > 0
                          ? expiryEntriesRaw
                          : [{ date: "", qty: "" }];

                      return (
                        <View key={skuKey} style={{ marginBottom: 12 }}>
                          {/* Render all expiry rows */}
                          {expiryEntries.map(
                            (
                              expiryItem: { date: string; qty: string },
                              index: number
                            ) => (
                              <View
                                key={`${skuKey}-${index}`}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  marginBottom: 10,
                                }}
                              >
                                {/* Always show SKU Label on every row */}
                                <Text style={[styles.skuText, { flex: 2 }]}>
                                  {skuItem.label}
                                </Text>

                                {/* Date Picker Button */}
                                <View style={{ flex: 3, marginHorizontal: 8 }}>
                                  <Button
                                    title={expiryItem.date || "Select Date"}
                                    onPress={() =>
                                      showDatePicker(skuKey, version, index)
                                    }
                                    disabled={!isEditable}
                                    color={isEditable ? "#2c1c5c" : "#d3d3d3"}
                                  />
                                </View>

                                {/* Quantity Field */}
                                <TextInput
                                  placeholder="Qty"
                                  placeholderTextColor={"grey"}
                                  style={[
                                    styles.inputBox,
                                    { flex: 1.5, height: 40, fontSize: 14 },
                                  ]}
                                  keyboardType="numeric"
                                  value={expiryItem.qty?.toString() || ""}
                                  onChangeText={(text) =>
                                    handleExpiryQtyChange(
                                      skuKey,
                                      version,
                                      index,
                                      text
                                    )
                                  }
                                  editable={isEditable}
                                />
                              </View>
                            )
                          )}

                          {/* Add & Remove Expiry Buttons */}
                          {isEditable && (
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginTop: 4,
                                paddingHorizontal: 8,
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => addExpiryEntry(skuKey, version)}
                              >
                                <Text
                                  style={{ color: "#2c1c5c", fontSize: 14 }}
                                >
                                  + Add Expiry
                                </Text>
                              </TouchableOpacity>

                              {expiryEntries.length > 1 ? (
                                <TouchableOpacity
                                  onPress={() =>
                                    deleteExpiryEntry(
                                      skuKey,
                                      version,
                                      expiryEntries.length - 1
                                    )
                                  }
                                >
                                  <Text style={{ color: "red", fontSize: 18 }}>
                                    ✕
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={{ width: 30 }} />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Android-only DateTimePicker */}
                    {showPicker && (
                      <DateTimePicker
                        value={new Date()}
                        mode="date"
                        display="calendar"
                        onChange={onDateChange}
                      />
                    )}
                  </View>
                )}
              </View>

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "Offtake" ? null : "Offtake"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "Offtake"
                      ? `Hide Offtake`
                      : `Expand Offtake`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "Offtake" && (
                  <View style={{ marginTop: 10 }}>
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Offtake"
                          style={styles.inputBox}
                          value={
                            skuValues.offtake?.[version]?.[skuItem.value] || ""
                          }
                          onChangeText={(text) =>
                            handleInputChange("offtake", skuItem.value, text)
                          }
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedSection((prev) =>
                      prev === "InventoryDaysLevel"
                        ? null
                        : "InventoryDaysLevel"
                    )
                  }
                >
                  <Text style={styles.expandButtonText}>
                    {expandedSection === "InventoryDaysLevel"
                      ? `Hide Inventory Days Level`
                      : `Expand Inventory Days Level`}
                  </Text>
                </TouchableOpacity>

                {expandedSection === "InventoryDaysLevel" && (
                  <TouchableOpacity
                    style={{ marginTop: 10 }}
                    activeOpacity={1}
                    onPress={() => {}}
                  >
                    {filteredSkuOptions.map((skuItem) => (
                      <View key={skuItem.value} style={styles.skuItemRow}>
                        <Text style={styles.skuText}>{skuItem.label}</Text>
                        <TextInput
                          placeholder="Inventory Days Level"
                          style={styles.inputBox}
                          value={
                            skuValues.inventoryDays?.[version]?.[
                              skuItem.value
                            ] || ""
                          }
                          onChangeText={(text) =>
                            handleInputChange(
                              "inventoryDays",
                              skuItem.value,
                              text
                            )
                          }
                        />
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={[
                  styles.buttonRow,
                  { justifyContent: "space-between", marginTop: 20 },
                ]}
              >
                <TouchableOpacity
                  style={[styles.submitButton, { flex: 1, marginRight: 5 }]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.submitButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { flex: 1, marginLeft: 5, opacity: loading ? 0.5 : 1 },
                  ]}
                  disabled={loading}
                  onPress={handleConditionalSubmit}
                >
                  <Text style={styles.submitButtonText}>
                    {loading
                      ? "Submitting..."
                      : `Submit (${getCompletedSkuCount()}/${getTotalSkuCount()})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}
